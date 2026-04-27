import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  authorizePayment,
  getPriceForTier,
  WORLDPAY_PLAN_TIERS,
} from "../_shared/worldpay.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WORLDPAY-RECURRING] ${step}${detailsStr}`);
};

serve(async (req) => {
  // This function is called by pg_cron with service role key
  // No CORS needed (server-to-server)

  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  // Verify this is called with service role key (from pg_cron or admin)
  if (!authHeader || !authHeader.includes(serviceRoleKey)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    serviceRoleKey,
    { auth: { persistSession: false } }
  );

  try {
    logStep("Recurring billing job started");

    // Find all Worldpay factories due for billing
    const { data: dueFactories, error: queryError } = await supabaseAdmin
      .from('factory_accounts')
      .select('id, name, subscription_tier, worldpay_token_href, worldpay_scheme_reference, billing_interval, billing_cycle_anchor, payment_failed_at')
      .eq('payment_provider', 'worldpay')
      .in('subscription_status', ['active', 'past_due'])
      .not('worldpay_token_href', 'is', null)
      .lte('billing_cycle_anchor', new Date().toISOString());

    if (queryError) {
      throw new Error(`Query error: ${queryError.message}`);
    }

    if (!dueFactories?.length) {
      logStep("No factories due for billing");
      return new Response(JSON.stringify({ processed: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    logStep("Factories due for billing", { count: dueFactories.length });

    const results: { factoryId: string; name: string; success: boolean; error?: string }[] = [];

    for (const factory of dueFactories) {
      const tier = factory.subscription_tier || 'starter';
      const interval = factory.billing_interval || 'month';

      // Skip if tier is not in our pricing (e.g. enterprise with custom pricing)
      if (!WORLDPAY_PLAN_TIERS[tier]) {
        logStep("Skipping factory with unknown tier", { factoryId: factory.id, tier });
        continue;
      }

      const amount = getPriceForTier(tier, interval);
      const transactionRef = `pp-${factory.id}-${Date.now()}`;

      logStep("Charging factory", {
        factoryId: factory.id,
        name: factory.name,
        tier,
        interval,
        amount,
      });

      try {
        const authResult = await authorizePayment({
          transactionReference: transactionRef,
          amount,
          currency: 'USD',
          paymentInstrument: {
            type: 'card/token',
            href: factory.worldpay_token_href,
          },
          customerAgreement: {
            type: 'subscription',
            storedCardUsage: 'subsequent',
            schemeReference: factory.worldpay_scheme_reference || undefined,
          },
          narrative: `Production Portal ${tier} renewal`,
        });

        if (authResult.outcome === 'authorized') {
          // Payment successful — advance billing anchor
          const nextAnchor = new Date(factory.billing_cycle_anchor);
          if (interval === 'year') {
            nextAnchor.setFullYear(nextAnchor.getFullYear() + 1);
          } else {
            nextAnchor.setMonth(nextAnchor.getMonth() + 1);
          }

          await supabaseAdmin
            .from('factory_accounts')
            .update({
              subscription_status: 'active',
              billing_cycle_anchor: nextAnchor.toISOString(),
              payment_failed_at: null,
            })
            .eq('id', factory.id);

          // Record successful payment
          await supabaseAdmin
            .from('worldpay_payments')
            .insert({
              factory_id: factory.id,
              amount,
              currency: 'USD',
              status: 'authorized',
              worldpay_transaction_ref: transactionRef,
              worldpay_links: authResult._links || null,
              description: `${tier} plan - ${interval}ly renewal`,
              tier,
              interval,
            });

          logStep("Payment successful", { factoryId: factory.id, nextAnchor: nextAnchor.toISOString() });
          results.push({ factoryId: factory.id, name: factory.name, success: true });

        } else {
          throw new Error(`Payment not authorized. Outcome: ${authResult.outcome}`);
        }

      } catch (paymentError) {
        const errorMsg = (paymentError as Error).message;
        logStep("Payment failed", { factoryId: factory.id, error: errorMsg });

        // Set past_due and record failure
        await supabaseAdmin
          .from('factory_accounts')
          .update({
            subscription_status: 'past_due',
            payment_failed_at: new Date().toISOString(),
          })
          .eq('id', factory.id);

        // Record failed payment
        await supabaseAdmin
          .from('worldpay_payments')
          .insert({
            factory_id: factory.id,
            amount,
            currency: 'USD',
            status: 'refused',
            worldpay_transaction_ref: transactionRef,
            description: `Failed: ${errorMsg}`,
            tier,
            interval,
          });

        // Send payment failure notification
        try {
          await fetch(
            `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-billing-notification`,
            {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${serviceRoleKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                factoryId: factory.id,
                type: 'payment_failed',
              }),
            }
          );
        } catch (_) { /* notification failure is non-blocking */ }

        results.push({ factoryId: factory.id, name: factory.name, success: false, error: errorMsg });
      }
    }

    logStep("Recurring billing job completed", {
      total: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
    });

    return new Response(JSON.stringify({
      processed: results.length,
      results,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    logStep("Fatal error", { message: (error as Error).message });

    try {
      await supabaseAdmin.from('app_error_logs').insert({
        error_message: (error as Error).message,
        error_stack: (error as Error).stack,
        source: 'worldpay-recurring',
        severity: 'critical',
      });
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
