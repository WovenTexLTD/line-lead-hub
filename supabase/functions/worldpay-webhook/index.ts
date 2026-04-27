import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { verifyWebhookSignature } from "../_shared/worldpay.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WORLDPAY-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  // Webhooks are server-to-server, no CORS needed
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const bodyText = await req.text();
    logStep("Webhook received", { bodyLength: bodyText.length });

    // Verify signature if present
    const signatureHeader = req.headers.get("Event-Signature") || '';
    if (signatureHeader) {
      const valid = await verifyWebhookSignature(bodyText, signatureHeader);
      if (!valid) {
        logStep("Invalid webhook signature");
        return new Response("Invalid signature", { status: 401 });
      }
      logStep("Signature verified");
    }

    const event = JSON.parse(bodyText);
    const eventId = event.eventId || 'unknown';
    const eventType = event.eventDetails?.type || event.paymentStatus || 'unknown';
    const transactionRef = event.eventDetails?.transactionReference
      || event.transactionReference
      || '';

    logStep("Processing event", { eventId, eventType, transactionRef });

    // Extract factory_id from transaction reference (format: pp-{factoryId}-{timestamp})
    let factoryId: string | null = null;
    if (transactionRef.startsWith('pp-')) {
      const parts = transactionRef.split('-');
      // UUID is parts 1-5 (pp-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-timestamp)
      if (parts.length >= 7) {
        factoryId = parts.slice(1, 6).join('-');
      }
    }

    if (!factoryId) {
      logStep("Could not extract factory_id from transaction reference", { transactionRef });
      // Still return 200 to prevent retries for events we can't process
      return new Response(JSON.stringify({ received: true, processed: false }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    logStep("Factory identified", { factoryId });

    switch (eventType) {
      case 'sentForSettlement':
      case 'settled': {
        logStep("Payment settled", { factoryId });

        // Update payment record status
        await supabaseAdmin
          .from('worldpay_payments')
          .update({ status: 'settled' })
          .eq('worldpay_transaction_ref', transactionRef);

        // Ensure factory is active
        await supabaseAdmin
          .from('factory_accounts')
          .update({
            subscription_status: 'active',
            payment_failed_at: null,
          })
          .eq('id', factoryId)
          .eq('payment_provider', 'worldpay');

        break;
      }

      case 'refused':
      case 'error': {
        logStep("Payment refused/error", { factoryId, eventType });

        // Update payment record
        await supabaseAdmin
          .from('worldpay_payments')
          .update({ status: eventType })
          .eq('worldpay_transaction_ref', transactionRef);

        // Set factory to past_due
        await supabaseAdmin
          .from('factory_accounts')
          .update({
            subscription_status: 'past_due',
            payment_failed_at: new Date().toISOString(),
          })
          .eq('id', factoryId)
          .eq('payment_provider', 'worldpay');

        // Send payment failure notification via existing function
        try {
          await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-billing-notification`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                factoryId,
                type: 'payment_failed',
              }),
            }
          );
        } catch (notifError) {
          logStep("Failed to send notification", { error: (notifError as Error).message });
        }

        break;
      }

      case 'refunded': {
        logStep("Payment refunded", { factoryId });

        await supabaseAdmin
          .from('worldpay_payments')
          .update({ status: 'refunded' })
          .eq('worldpay_transaction_ref', transactionRef);

        break;
      }

      default: {
        logStep("Unhandled event type", { eventType });
      }
    }

    // Log the event for audit
    await supabaseAdmin.from('app_error_logs').insert({
      error_message: `Worldpay webhook: ${eventType}`,
      source: 'worldpay-webhook',
      severity: 'info',
      metadata: { eventId, eventType, transactionRef, factoryId },
    });

    return new Response(JSON.stringify({ received: true, processed: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    logStep("Webhook processing error", { message: (error as Error).message });

    // Always return 200 to prevent Worldpay from retrying on our processing errors
    // Log the error for investigation
    try {
      await supabaseAdmin.from('app_error_logs').insert({
        error_message: (error as Error).message,
        error_stack: (error as Error).stack,
        source: 'worldpay-webhook',
        severity: 'error',
      });
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ received: true, processed: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});
