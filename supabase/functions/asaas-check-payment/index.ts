import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY")!;
const ASAAS_BASE_URL = "https://api.asaas.com/v3";

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

    const { paymentId } = await req.json();

    if (!paymentId) {
      throw new Error("Payment ID required");
    }

    const paymentResponse = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}`, {
      headers: { "access_token": ASAAS_API_KEY },
    });

    const payment = await paymentResponse.json();

    if (payment.errors) {
      throw new Error("Pagamento não encontrado");
    }

    // If payment is confirmed, update user balance
    if (payment.status === "CONFIRMED" || payment.status === "RECEIVED") {
      let referenceData;
      try {
        referenceData = JSON.parse(payment.externalReference || "{}");
      } catch {
        referenceData = {};
      }

      if (referenceData.userId === user.id && referenceData.type === "deposit") {
        // Check if already processed by looking for existing transaction
        const { data: existingTx } = await supabaseClient
          .from("transactions")
          .select("id")
          .eq("user_id", user.id)
          .eq("type", "deposit")
          .ilike("description", `%${paymentId}%`)
          .single();

        if (!existingTx) {
          // Get current balance
          const { data: profile } = await supabaseClient
            .from("profiles")
            .select("balance")
            .eq("id", user.id)
            .single();

          if (profile) {
            const newBalance = Number(profile.balance) + payment.value;

            await supabaseClient
              .from("profiles")
              .update({ balance: newBalance })
              .eq("id", user.id);

            await supabaseClient.from("transactions").insert({
              user_id: user.id,
              type: "deposit",
              amount: payment.value,
              description: `Depósito via ${payment.billingType} - Asaas #${paymentId}`,
            });

            console.log(`Manual check: Deposit confirmed for user ${user.id}: R$ ${payment.value}`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        status: payment.status,
        value: payment.value,
        billingType: payment.billingType,
        confirmedDate: payment.confirmedDate,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error checking payment:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
