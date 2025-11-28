import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.85.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    console.log("Asaas webhook received:", JSON.stringify(body));

    const { event, payment } = body;

    if (!payment?.externalReference) {
      console.log("No external reference, skipping");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let referenceData;
    try {
      referenceData = JSON.parse(payment.externalReference);
    } catch {
      console.log("Invalid external reference format");
      return new Response(JSON.stringify({ received: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, type, sellerId, withdrawalId } = referenceData;

    // Handle deposit confirmation
    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
      if (type === "deposit" && userId) {
        // Get current balance
        const { data: profile } = await supabaseClient
          .from("profiles")
          .select("balance")
          .eq("id", userId)
          .single();

        if (profile) {
          const newBalance = Number(profile.balance) + payment.value;

          // Update balance
          await supabaseClient
            .from("profiles")
            .update({ balance: newBalance })
            .eq("id", userId);

          // Create transaction record
          await supabaseClient.from("transactions").insert({
            user_id: userId,
            type: "deposit",
            amount: payment.value,
            description: `Depósito via ${payment.billingType} - Asaas #${payment.id}`,
          });

          console.log(`Deposit confirmed for user ${userId}: R$ ${payment.value}`);
        }
      }
    }

    // Handle transfer (withdrawal) completion
    if (event === "TRANSFER_CONFIRMED" || event === "TRANSFER_DONE") {
      if (type === "withdrawal" && withdrawalId) {
        await supabaseClient
          .from("withdrawals")
          .update({
            status: "completed",
            processed_at: new Date().toISOString(),
          })
          .eq("id", withdrawalId);

        console.log(`Withdrawal ${withdrawalId} completed`);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Webhook error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
