import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/security.ts";
import {
  authorizePayment,
  createToken,
  getPriceForTier,
  getMaxLinesForTier,
  WORLDPAY_PLAN_TIERS,
} from "../_shared/worldpay.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WORLDPAY-PROCESS-PAYMENT] ${step}${detailsStr}`);
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
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get factory_id from profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('factory_id')
      .eq('id', user.id)
      .single();

    const factoryId = profile?.factory_id;
    if (!factoryId) throw new Error("No factory found. Please create a factory first.");
    logStep("Factory found", { factoryId });

    const body = await req.json();
    const { sessionHref, tier, interval = 'month' } = body;

    if (!sessionHref) throw new Error("Missing sessionHref from checkout");
    if (!tier || !WORLDPAY_PLAN_TIERS[tier]) throw new Error(`Invalid tier: ${tier}`);
    logStep("Request body", { tier, interval, sessionHref: sessionHref.substring(0, 50) + '...' });

    const amount = getPriceForTier(tier, interval);
    const maxLines = getMaxLinesForTier(tier);
    const transactionRef = `pp-${factoryId}-${Date.now()}`;

    // Step 1: Authorize the initial payment
    logStep("Authorizing payment", { amount, transactionRef });
    const authResult = await authorizePayment({
      transactionReference: transactionRef,
      amount,
      currency: 'USD',
      paymentInstrument: {
        type: 'card/checkout+session',
        sessionHref,
      },
      customerAgreement: {
        type: 'subscription',
        storedCardUsage: 'first',
      },
      narrative: `Production Portal ${tier} plan`,
    });

    logStep("Payment authorized", { outcome: authResult.outcome, schemeReference: authResult.schemeReference });

    if (authResult.outcome !== 'authorized') {
      throw new Error(`Payment was not authorized. Outcome: ${authResult.outcome}`);
    }

    // Step 2: Create a stored token for recurring billing
    logStep("Creating stored token");
    const { tokenHref, tokenId } = await createToken(sessionHref);
    logStep("Token created", { tokenId });

    // Step 3: Calculate next billing date
    const billingAnchor = new Date();
    if (interval === 'year') {
      billingAnchor.setFullYear(billingAnchor.getFullYear() + 1);
    } else {
      billingAnchor.setMonth(billingAnchor.getMonth() + 1);
    }

    // Step 4: Update factory account
    logStep("Updating factory account");
    const { error: updateError } = await supabaseAdmin
      .from('factory_accounts')
      .update({
        payment_provider: 'worldpay',
        worldpay_token_href: tokenHref,
        worldpay_scheme_reference: authResult.schemeReference || null,
        billing_cycle_anchor: billingAnchor.toISOString(),
        billing_interval: interval,
        subscription_status: 'active',
        subscription_tier: tier,
        max_lines: maxLines,
        payment_failed_at: null,
      })
      .eq('id', factoryId);

    if (updateError) {
      logStep("Factory update error", { error: updateError.message });
      throw new Error(`Failed to update factory: ${updateError.message}`);
    }

    // Step 5: Record payment in history
    await supabaseAdmin
      .from('worldpay_payments')
      .insert({
        factory_id: factoryId,
        amount,
        currency: 'USD',
        status: 'authorized',
        worldpay_transaction_ref: transactionRef,
        worldpay_links: authResult._links || null,
        description: `${tier} plan - ${interval}ly subscription`,
        tier,
        interval,
      });

    logStep("Payment recorded and factory updated successfully");

    // Step 6: Create notification for factory admins
    const { data: adminUsers } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('factory_id', factoryId)
      .in('role', ['admin', 'owner']);

    if (adminUsers?.length) {
      const notifications = adminUsers.map((u: { user_id: string }) => ({
        user_id: u.user_id,
        title: 'Subscription Activated',
        message: `Your ${tier} plan is now active. Next billing date: ${billingAnchor.toLocaleDateString()}.`,
        type: 'billing',
      }));

      await supabaseAdmin.from('notifications').insert(notifications);
    }

    return new Response(JSON.stringify({
      success: true,
      tier,
      interval,
      maxLines,
      billingCycleAnchor: billingAnchor.toISOString(),
      redirectUrl: '/billing-plan?payment=success&tier=' + tier + '&interval=' + interval,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logStep("Error", { message: error.message });

    // Log to app_error_logs
    try {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        { auth: { persistSession: false } }
      );
      await supabaseAdmin.from('app_error_logs').insert({
        error_message: error.message,
        error_stack: error.stack,
        source: 'worldpay-process-payment',
        severity: 'error',
      });
    } catch (_) { /* ignore logging errors */ }

    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
