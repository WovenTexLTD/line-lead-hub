import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Plan tier configuration - matches frontend plan-tiers.ts (LIVE)
// Tiers are ordered from lowest to highest
const PLAN_TIERS = {
  starter: {
    priceId: "price_1SnFcPHWgEvVObNzV8DUHzpe",
    productId: "prod_Tkl8Q1w6HfSqER",
    maxLines: 30,
    order: 1,
  },
  growth: {
    priceId: "price_1SnFcNHWgEvVObNzag27TfQY",
    productId: "prod_Tkl8hBoNi8dZZL",
    maxLines: 60,
    order: 2,
  },
  scale: {
    priceId: "price_1SnFcIHWgEvVObNz2u1IfoEw",
    productId: "prod_Tkl8LGqEjZVnRG",
    maxLines: 100,
    order: 3,
  },
};

// Map price IDs to tier names for current plan detection
const PRICE_TO_TIER: Record<string, string> = {
  price_1SnFcPHWgEvVObNzV8DUHzpe: "starter",
  price_1SnFcNHWgEvVObNzag27TfQY: "growth",
  price_1SnFcIHWgEvVObNz2u1IfoEw: "scale",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHANGE-SUBSCRIPTION] ${step}${detailsStr}`);
};

const pickBestSubscription = (subs: Stripe.Subscription[]) => {
  const priority: Stripe.Subscription.Status[] = [
    "active",
    "trialing",
    "past_due",
    "unpaid",
    "incomplete",
  ];

  for (const status of priority) {
    const found = subs.find((s) => s.status === status);
    if (found) return found;
  }

  return subs[0] ?? null;
};

const resolveSubscription = async (args: {
  stripe: Stripe;
  // deno + supabase-js types are extremely strict in edge functions; keep this untyped for reliability
  supabaseAdmin: any;
  factoryId: string;
  userEmail: string;
  stripeSubscriptionId: string | null;
  stripeCustomerId: string | null;
}) => {
  const { stripe, supabaseAdmin, factoryId, userEmail } = args;

  // 1) Try stored subscription id first (fast path)
  if (args.stripeSubscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(args.stripeSubscriptionId);
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

      return { subscription, customerId, repaired: false };
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      if (!msg.includes("No such subscription")) throw e;
      logStep("Stored subscription id invalid; attempting recovery", {
        stripeSubscriptionId: args.stripeSubscriptionId,
      });
    }
  }

  // 2) Recover by customer id or email
  let customerId = args.stripeCustomerId || null;

  if (!customerId) {
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error(
        "No billing customer found for this account. Please subscribe first (or use Manage Billing)."
      );
    }
    customerId = customers.data[0].id;
  }

  const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
  const candidates = subs.data.filter(
    (s: Stripe.Subscription) => s.status !== "canceled" && (s.items?.data?.length ?? 0) > 0
  );

  const subscription = pickBestSubscription(candidates);
  if (!subscription) {
    throw new Error(
      "No active subscription found. Please subscribe first (or use Manage Billing)."
    );
  }

  // Persist repaired ids so the next call is fast + reliable
  await (supabaseAdmin as any)
    .from("factory_accounts")
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
    })
    .eq("id", factoryId);

  logStep("Recovered Stripe IDs and updated factory account", {
    factoryId,
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
  });

  return { subscription, customerId, repaired: true };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin: any = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseAdmin.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");

    const { newTier } = await req.json();
    if (!newTier) throw new Error("New tier is required");

    const tierConfig = PLAN_TIERS[newTier as keyof typeof PLAN_TIERS];
    if (!tierConfig) throw new Error(`Invalid tier: ${newTier}. Enterprise requires contacting sales.`);

    logStep("Request body", { newTier, priceId: tierConfig.priceId });

    // Get user's factory
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("factory_id")
      .eq("id", user.id)
      .single();

    if (!profile?.factory_id) throw new Error("No factory associated with user");

    // Get factory subscription info
    const { data: factory } = await supabaseAdmin
      .from("factory_accounts")
      .select("stripe_subscription_id, stripe_customer_id, subscription_tier")
      .eq("id", profile.factory_id)
      .single();

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Resolve active subscription (self-heals if stored IDs are stale)
    const { subscription, customerId } = await resolveSubscription({
      stripe,
      supabaseAdmin,
      factoryId: profile.factory_id,
      userEmail: user.email,
      stripeSubscriptionId: factory?.stripe_subscription_id ?? null,
      stripeCustomerId: factory?.stripe_customer_id ?? null,
    });

    const currentPriceId = subscription.items.data[0]?.price?.id;
    if (!currentPriceId) throw new Error("Could not determine current plan price");

    const currentTierName = PRICE_TO_TIER[currentPriceId] || factory?.subscription_tier || "starter";
    const currentTierConfig = PLAN_TIERS[currentTierName as keyof typeof PLAN_TIERS];
    if (!currentTierConfig) throw new Error("Could not determine current plan tier");

    const isUpgrade = tierConfig.order > currentTierConfig.order;
    const isDowngrade = tierConfig.order < currentTierConfig.order;

    if (!isUpgrade && !isDowngrade) throw new Error("You are already on this plan");

    logStep("Plan change type", {
      currentTier: currentTierName,
      newTier,
      isUpgrade,
      isDowngrade,
      currentOrder: currentTierConfig.order,
      newOrder: tierConfig.order,
    });

    let result: any;

    if (isUpgrade) {
      // UPGRADE LOGIC
      // - Immediate change
      // - Proration invoiced immediately (user pays the prorated difference now)
      logStep("Processing UPGRADE - immediate with proration");

      const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
        items: [{ id: subscription.items.data[0].id, price: tierConfig.priceId }],
        proration_behavior: "always_invoice",
        metadata: {
          ...subscription.metadata,
          tier: newTier,
        },
      });

      // Update factory record immediately for upgrades
      await supabaseAdmin
        .from("factory_accounts")
        .update({
          subscription_tier: newTier,
          max_lines: tierConfig.maxLines,
        })
        .eq("id", profile.factory_id);

      result = {
        success: true,
        changeType: "upgrade",
        newTier,
        maxLines: tierConfig.maxLines,
        effectiveImmediately: true,
        message: `Upgraded to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)} plan. Your new limits are active now.`,
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
        },
      };
    } else {
      // DOWNGRADE LOGIC
      // - Change scheduled for next billing cycle (no immediate charge)
      // - Customer keeps current tier until renewal
      logStep("Processing DOWNGRADE - scheduled for next billing cycle");

      // Check if customer has a default payment method (advisory only)
      const customer = (await stripe.customers.retrieve(customerId)) as Stripe.Customer;
      const hasPaymentMethod =
        !!customer.invoice_settings?.default_payment_method || customer.default_source !== null;

      const periodEnd = subscription.current_period_end;
      const nextBillingDateIso = new Date(periodEnd * 1000).toISOString();

      // Schedule downgrade at period end
      const scheduleFromSub = await stripe.subscriptionSchedules.create({
        from_subscription: subscription.id,
      });

      const updatedSchedule = await stripe.subscriptionSchedules.update(scheduleFromSub.id, {
        phases: [
          {
            items: [{ price: currentPriceId, quantity: 1 }],
            start_date: subscription.current_period_start,
            end_date: periodEnd,
          },
          {
            items: [{ price: tierConfig.priceId, quantity: 1 }],
            start_date: periodEnd,
            metadata: { tier: newTier },
          },
        ],
      });

      result = {
        success: true,
        changeType: "downgrade",
        newTier,
        maxLines: tierConfig.maxLines,
        effectiveImmediately: false,
        scheduledDate: nextBillingDateIso,
        message: `Downgrade to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)} plan scheduled. You'll continue on your current plan until ${new Date(nextBillingDateIso).toLocaleDateString()}.`,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: nextBillingDateIso,
        },
        schedule: {
          id: updatedSchedule.id,
          status: updatedSchedule.status,
        },
        needsPaymentMethod: !hasPaymentMethod,
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });

    // Return 200 so the frontend can show a useful error message (instead of generic non-2xx).
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }
});
