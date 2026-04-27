import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/security.ts";
import {
  authorizePayment,
  getPriceForTier,
  getMaxLinesForTier,
  WORLDPAY_PLAN_TIERS,
} from "../_shared/worldpay.ts";

const TIER_ORDER = ['starter', 'growth', 'scale'];

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WORLDPAY-CHANGE-SUB] ${step}${detailsStr}`);
};

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    logStep("Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError) throw new Error(`Authentication error: ${authError.message}`);
    const user = data.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Get factory
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('factory_id')
      .eq('id', user.id)
      .single();

    const factoryId = profile?.factory_id;
    if (!factoryId) throw new Error("No factory found");

    const { data: factory } = await supabaseAdmin
      .from('factory_accounts')
      .select('subscription_tier, subscription_status, payment_provider, worldpay_token_href, worldpay_scheme_reference, billing_cycle_anchor, billing_interval')
      .eq('id', factoryId)
      .single();

    if (!factory) throw new Error("Factory not found");
    if (factory.payment_provider !== 'worldpay') throw new Error("This factory is not using Worldpay billing");
    if (factory.subscription_status !== 'active') throw new Error("Subscription is not active");

    const body = await req.json();
    const { newTier, newInterval } = body;

    if (!newTier || !WORLDPAY_PLAN_TIERS[newTier]) {
      throw new Error(`Invalid tier: ${newTier}`);
    }

    const currentTier = factory.subscription_tier || 'starter';
    const currentInterval = factory.billing_interval || 'month';
    const currentTierIndex = TIER_ORDER.indexOf(currentTier);
    const newTierIndex = TIER_ORDER.indexOf(newTier);

    logStep("Plan change requested", { currentTier, newTier, currentInterval, newInterval: newInterval || currentInterval });

    const isUpgrade = newTierIndex > currentTierIndex
      || (newTierIndex === currentTierIndex && newInterval === 'year' && currentInterval === 'month');
    const isDowngrade = newTierIndex < currentTierIndex
      || (newTierIndex === currentTierIndex && newInterval === 'month' && currentInterval === 'year');

    if (!isUpgrade && !isDowngrade) {
      throw new Error("No plan change detected — already on this plan");
    }

    const effectiveInterval = newInterval || currentInterval;

    if (isUpgrade) {
      // Upgrade: charge the difference immediately and update plan
      logStep("Processing upgrade");

      const currentPrice = getPriceForTier(currentTier, currentInterval);
      const newPrice = getPriceForTier(newTier, effectiveInterval);

      // Calculate prorated amount (simplified: charge difference for remaining period)
      // For a more accurate proration, you'd calculate based on billing_cycle_anchor
      const proratedAmount = Math.max(0, newPrice - currentPrice);
      const transactionRef = `pp-${factoryId}-upgrade-${Date.now()}`;

      if (proratedAmount > 0 && factory.worldpay_token_href) {
        logStep("Charging upgrade difference", { proratedAmount });

        const authResult = await authorizePayment({
          transactionReference: transactionRef,
          amount: proratedAmount,
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
          narrative: `Production Portal upgrade to ${newTier}`,
        });

        if (authResult.outcome !== 'authorized') {
          throw new Error(`Upgrade payment failed. Outcome: ${authResult.outcome}`);
        }

        // Record upgrade payment
        await supabaseAdmin.from('worldpay_payments').insert({
          factory_id: factoryId,
          amount: proratedAmount,
          currency: 'USD',
          status: 'authorized',
          worldpay_transaction_ref: transactionRef,
          worldpay_links: authResult._links || null,
          description: `Upgrade from ${currentTier} to ${newTier}`,
          tier: newTier,
          interval: effectiveInterval,
        });
      }

      // Update factory with new plan
      await supabaseAdmin
        .from('factory_accounts')
        .update({
          subscription_tier: newTier,
          max_lines: getMaxLinesForTier(newTier),
          billing_interval: effectiveInterval,
        })
        .eq('id', factoryId);

      logStep("Upgrade completed", { newTier, newMaxLines: getMaxLinesForTier(newTier) });

      return new Response(JSON.stringify({
        success: true,
        changeType: 'upgrade',
        newTier,
        newInterval: effectiveInterval,
        maxLines: getMaxLinesForTier(newTier),
        message: `Upgraded to ${newTier} plan.`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });

    } else {
      // Downgrade: schedule for end of current billing period
      logStep("Scheduling downgrade");

      const effectiveDate = factory.billing_cycle_anchor || new Date().toISOString();

      await supabaseAdmin
        .from('factory_accounts')
        .update({
          pending_plan_change: {
            newTier,
            newInterval: effectiveInterval,
            newMaxLines: getMaxLinesForTier(newTier),
            effectiveDate,
            requestedAt: new Date().toISOString(),
          },
        })
        .eq('id', factoryId);

      logStep("Downgrade scheduled", { newTier, effectiveDate });

      return new Response(JSON.stringify({
        success: true,
        changeType: 'downgrade',
        newTier,
        newInterval: effectiveInterval,
        effectiveDate,
        message: `Downgrade to ${newTier} scheduled for ${new Date(effectiveDate).toLocaleDateString()}.`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

  } catch (error) {
    logStep("Error", { message: (error as Error).message });
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
