import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/security.ts";
import {
  createCheckoutSession,
  getCheckoutId,
  getPriceForTier,
  getMaxLinesForTier,
  WORLDPAY_PLAN_TIERS,
} from "../_shared/worldpay.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WORLDPAY-CHECKOUT] ${step}${detailsStr}`);
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
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }
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
    logStep("Profile checked", { factoryId: factoryId || 'none' });

    const body = await req.json().catch(() => ({}));
    const { tier = 'starter', startTrial = false, interval = 'month' } = body;
    logStep("Request body", { tier, startTrial, interval });

    // Validate tier
    if (tier === 'enterprise') {
      throw new Error("Enterprise plan requires contacting sales");
    }
    if (!WORLDPAY_PLAN_TIERS[tier]) {
      throw new Error(`Invalid tier: ${tier}`);
    }

    // --- Trial path: no Worldpay involved ---
    if (startTrial) {
      logStep("Starting free trial");

      const trialEndDate = new Date();
      trialEndDate.setDate(trialEndDate.getDate() + 14);

      if (factoryId) {
        const { error: updateError } = await supabaseAdmin
          .from('factory_accounts')
          .update({
            subscription_status: 'trial',
            subscription_tier: tier,
            max_lines: getMaxLinesForTier(tier),
            trial_end_date: trialEndDate.toISOString(),
            payment_provider: 'worldpay',
          })
          .eq('id', factoryId);

        if (updateError) {
          logStep("Factory update error", { error: updateError.message });
          throw new Error(`Failed to start trial: ${updateError.message}`);
        }
        logStep("Trial started for existing factory", { factoryId, trialEnd: trialEndDate.toISOString() });
      }

      return new Response(JSON.stringify({
        success: true,
        trial: true,
        redirectUrl: factoryId ? '/billing-plan?trial=true' : '/setup/factory?payment=success&trial=true',
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // --- Paid path: create Worldpay checkout session ---
    logStep("Creating Worldpay checkout session");

    const amount = getPriceForTier(tier, interval);
    const sessionHref = await createCheckoutSession();
    const checkoutId = getCheckoutId();

    logStep("Checkout session created", { sessionHref, checkoutId, amount });

    return new Response(JSON.stringify({
      success: true,
      sessionHref,
      checkoutId,
      tier,
      interval,
      amount,
      currency: 'USD',
      factoryId: factoryId || null,
      userId: user.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logStep("Error", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
