import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_BASE_URL = "https://api.asaas.com/v3";

interface WithdrawalRequest {
  amount: number;
  pixKey: string;
  pixKeyType: "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
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

    const { amount, pixKey, pixKeyType }: WithdrawalRequest = await req.json();

    if (!amount || amount < 10) {
      throw new Error("Valor mínimo para saque é R$ 10,00");
    }

    // Calculate 5% admin fee
    const adminFee = amount * 0.05;
    const netAmount = amount - adminFee;

    // Check if user is a seller
    const { data: seller } = await supabaseClient
      .from("sellers")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!seller) {
      throw new Error("Apenas vendedores podem solicitar saques");
    }

    // Get user profile for balance check
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("balance")
      .eq("id", user.id)
      .single();

    if (!profile || Number(profile.balance) < amount) {
      throw new Error("Saldo insuficiente");
    }

    // Get admin user (first user with admin role)
    const { data: adminRole } = await supabaseClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .single();

    // Create withdrawal record (with net amount after fee)
    const { data: withdrawal, error: withdrawalError } = await supabaseClient
      .from("withdrawals")
      .insert({
        seller_id: seller.id,
        amount: netAmount,
        payment_method: "PIX",
        payment_details: { pixKey, pixKeyType, originalAmount: amount, adminFee },
        status: "pending",
      })
      .select()
      .single();

    if (withdrawalError) {
      throw new Error("Falha ao criar solicitação de saque");
    }

    // Deduct full amount from seller balance
    const newBalance = Number(profile.balance) - amount;
    await supabaseClient
      .from("profiles")
      .update({ balance: newBalance })
      .eq("id", user.id);

    // Add fee to admin balance if admin exists
    if (adminRole?.user_id) {
      const { data: adminProfile } = await supabaseClient
        .from("profiles")
        .select("balance")
        .eq("id", adminRole.user_id)
        .single();

      if (adminProfile) {
        const newAdminBalance = Number(adminProfile.balance) + adminFee;
        await supabaseClient
          .from("profiles")
          .update({ balance: newAdminBalance })
          .eq("id", adminRole.user_id);

        // Record admin fee transaction
        await supabaseClient.from("transactions").insert({
          user_id: adminRole.user_id,
          type: "fee",
          amount: adminFee,
          description: `Taxa de saque (5%) - Seller ${seller.id}`,
        });
      }
    }

    // Create transaction record for seller
    await supabaseClient.from("transactions").insert({
      user_id: user.id,
      type: "withdrawal",
      amount: -amount,
      description: `Solicitação de saque via PIX (Taxa: R$ ${adminFee.toFixed(2)})`,
    });

    // Try to create transfer in Asaas (admin will need to approve)
    try {
      const transferResponse = await fetch(`${ASAAS_BASE_URL}/transfers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "access_token": ASAAS_API_KEY,
        },
        body: JSON.stringify({
          value: netAmount,
          pixAddressKey: pixKey,
          pixAddressKeyType: pixKeyType,
          description: `Saque - Seller ${seller.id}`,
          externalReference: JSON.stringify({
            type: "withdrawal",
            withdrawalId: withdrawal.id,
            sellerId: seller.id,
          }),
        }),
      });

      const transfer = await transferResponse.json();
      console.log("Transfer created:", transfer);

      if (transfer.id) {
        await supabaseClient
          .from("withdrawals")
          .update({ status: "approved" })
          .eq("id", withdrawal.id);
      }
    } catch (transferError) {
      console.error("Transfer creation failed, withdrawal pending manual approval:", transferError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        withdrawalId: withdrawal.id,
        message: "Solicitação de saque criada com sucesso",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error creating withdrawal:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
