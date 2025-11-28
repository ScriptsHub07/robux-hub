import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_BASE_URL = "https://api.asaas.com/v3";

interface PaymentRequest {
  amount: number;
  userId: string;
  billingType: "PIX" | "BOLETO" | "CREDIT_CARD";
  cpf?: string;
  description?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Authorization header required");
    }

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { amount, billingType, cpf, description }: PaymentRequest = await req.json();

    if (!amount || amount < 5) {
      throw new Error("Valor mínimo é R$ 5,00");
    }

    // Get user profile for customer data
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!profile) {
      throw new Error("Profile not found");
    }

    // Prepare customer data with CPF if provided
    const customerData: Record<string, unknown> = {
      name: profile.username,
      email: profile.email,
      externalReference: user.id,
    };

    // Add CPF to customer data if provided
    if (cpf) {
      // Formatar CPF para o padrão esperado pelo Asaas (somente números)
      const formattedCpf = cpf.replace(/\D/g, '');
      if (formattedCpf.length === 11) {
        customerData.cpfCnpj = formattedCpf;
      }
    } else if (profile.cpf) {
      // Usar CPF do perfil se não foi enviado no request
      const formattedCpf = profile.cpf.replace(/\D/g, '');
      if (formattedCpf.length === 11) {
        customerData.cpfCnpj = formattedCpf;
      }
    }

    // First, create or get customer in Asaas
    const customerResponse = await fetch(`${ASAAS_BASE_URL}/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
      },
      body: JSON.stringify(customerData),
    });

    let customer;
    if (customerResponse.status === 409) {
      // Customer already exists, find by email
      const listResponse = await fetch(`${ASAAS_BASE_URL}/customers?email=${encodeURIComponent(profile.email)}`, {
        headers: { "access_token": ASAAS_API_KEY },
      });
      const listData = await listResponse.json();
      customer = listData.data?.[0];
    } else {
      customer = await customerResponse.json();
    }

    if (!customer?.id) {
      console.error("Customer creation failed:", customer);
      throw new Error("Falha ao criar cliente no Asaas");
    }

    // Create payment
    const paymentBody: Record<string, unknown> = {
      customer: customer.id,
      billingType,
      value: amount,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      description: description || `Depósito de saldo - ${profile.username}`,
      externalReference: JSON.stringify({ userId: user.id, type: "deposit" }),
    };

    const paymentResponse = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "access_token": ASAAS_API_KEY,
      },
      body: JSON.stringify(paymentBody),
    });

    const payment = await paymentResponse.json();

    if (payment.errors) {
      console.error("Payment creation failed:", payment);
      throw new Error(payment.errors[0]?.description || "Falha ao criar pagamento");
    }

    console.log("Payment created:", payment.id);

    // If PIX, get PIX QR Code
    let pixData = null;
    if (billingType === "PIX") {
      const pixResponse = await fetch(`${ASAAS_BASE_URL}/payments/${payment.id}/pixQrCode`, {
        headers: { "access_token": ASAAS_API_KEY },
      });
      pixData = await pixResponse.json();
    }

    return new Response(
      JSON.stringify({
        paymentId: payment.id,
        status: payment.status,
        billingType: payment.billingType,
        value: payment.value,
        dueDate: payment.dueDate,
        invoiceUrl: payment.invoiceUrl,
        bankSlipUrl: payment.bankSlipUrl,
        pixQrCode: pixData?.encodedImage,
        pixCopyPaste: pixData?.payload,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error creating payment:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});