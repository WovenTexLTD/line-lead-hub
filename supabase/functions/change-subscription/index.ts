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
    priceIdMonthly: "price_1SnFcPHWgEvVObNzV8DUHzpe",
    priceIdYearly: "price_1SnGNvHWgEvVObNzzSlIyDmj",
    productId: "prod_Tkl8Q1w6HfSqER",
    maxLines: 30,
    order: 1,
    monthlyAmount: 39999,
    yearlyAmount: 407990,
  },
  growth: {
    priceIdMonthly: "price_1SnFcNHWgEvVObNzag27TfQY",
    priceIdYearly: "price_1SnGPGHWgEvVObNz1cEK82X6",
    productId: "prod_Tkl8hBoNi8dZZL",
    maxLines: 60,
    order: 2,
    monthlyAmount: 54999,
    yearlyAmount: 560990,
  },
  scale: {
    priceIdMonthly: "price_1SnFcIHWgEvVObNz2u1IfoEw",
    priceIdYearly: "price_1SnGQQHWgEvVObNz6Gf4ff6Y",
    productId: "prod_Tkl8LGqEjZVnRG",
    maxLines: 100,
    order: 3,
    monthlyAmount: 62999,
    yearlyAmount: 642590,
  },
};

// Map price IDs to tier names and intervals for current plan detection
const PRICE_TO_TIER: Record<string, { tier: string; interval: "month" | "year" }> = {
  // Monthly
  price_1SnFcPHWgEvVObNzV8DUHzpe: { tier: "starter", interval: "month" },
  price_1SnFcNHWgEvVObNzag27TfQY: { tier: "growth", interval: "month" },
  price_1SnFcIHWgEvVObNz2u1IfoEw: { tier: "scale", interval: "month" },
  // Yearly
  price_1SnGNvHWgEvVObNzzSlIyDmj: { tier: "starter", interval: "year" },
  price_1SnGPGHWgEvVObNz1cEK82X6: { tier: "growth", interval: "year" },
  price_1SnGQQHWgEvVObNz6Gf4ff6Y: { tier: "scale", interval: "year" },
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

  // Validate stored customer id (it may be stale / from a different Stripe environment)
  if (customerId) {
    try {
      await stripe.customers.retrieve(customerId);
    } catch (e: any) {
      const msg = e?.message ? String(e.message) : String(e);
      if (msg.includes("No such customer")) {
        logStep("Stored customer id invalid; attempting recovery by email", {
          stripeCustomerId: customerId,
        });
        customerId = null;
      } else {
        throw e;
      }
    }
  }

  if (!customerId) {
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    if (customers.data.length === 0) {
      throw new Error(
        "No billing customer found for this account. Please subscribe first (or use Manage Billing)."
      );
    }
    customerId = customers.data[0].id;
  }

  let subs;
  try {
    subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    if (msg.includes("No such customer")) {
      logStep("Customer id rejected by Stripe; retrying lookup by email", { customerId });
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length === 0) {
        throw new Error(
          "No billing customer found for this account. Please subscribe first (or use Manage Billing)."
        );
      }
      customerId = customers.data[0].id;
      subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 });
    } else {
      throw e;
    }
  }

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

// Get effective amount for comparison (normalize yearly to monthly equivalent)
const getEffectiveAmount = (tierConfig: typeof PLAN_TIERS.starter, interval: "month" | "year"): number => {
  if (interval === "year") {
    return tierConfig.yearlyAmount / 12; // Monthly equivalent
  }
  return tierConfig.monthlyAmount;
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

    const { newTier, billingInterval = "month" } = await req.json();
    if (!newTier) throw new Error("New tier is required");

    const tierConfig = PLAN_TIERS[newTier as keyof typeof PLAN_TIERS];
    if (!tierConfig) throw new Error(`Invalid tier: ${newTier}. Enterprise requires contacting sales.`);

    // Get the correct price ID based on billing interval
    const targetPriceId = billingInterval === "year" ? tierConfig.priceIdYearly : tierConfig.priceIdMonthly;
    
    logStep("Request body", { newTier, billingInterval, targetPriceId });

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

    const currentPriceMapping = PRICE_TO_TIER[currentPriceId];
    const currentTierName = currentPriceMapping?.tier || factory?.subscription_tier || "starter";
    const currentInterval = currentPriceMapping?.interval || "month";
    const currentTierConfig = PLAN_TIERS[currentTierName as keyof typeof PLAN_TIERS];
    
    if (!currentTierConfig) throw new Error("Could not determine current plan tier");

    // Determine if this is an upgrade or downgrade
    // Compare by tier order first, then by effective monthly amount if same tier
    let isUpgrade: boolean;
    let isDowngrade: boolean;

    if (tierConfig.order !== currentTierConfig.order) {
      // Different tier - compare by order
      isUpgrade = tierConfig.order > currentTierConfig.order;
      isDowngrade = tierConfig.order < currentTierConfig.order;
    } else {
      // Same tier - compare by effective amount (yearly is cheaper per month)
      const currentEffective = getEffectiveAmount(currentTierConfig, currentInterval);
      const newEffective = getEffectiveAmount(tierConfig, billingInterval as "month" | "year");
      
      // Switching from monthly to yearly at same tier is technically a "downgrade" in price
      // but we treat it as an upgrade (immediate) since it's a commitment
      if (currentInterval === "month" && billingInterval === "year") {
        isUpgrade = true;
        isDowngrade = false;
      } else if (currentInterval === "year" && billingInterval === "month") {
        isUpgrade = false;
        isDowngrade = true;
      } else {
        // Same interval, same tier - no change
        throw new Error("You are already on this plan");
      }
    }

    if (!isUpgrade && !isDowngrade) throw new Error("You are already on this plan");

    logStep("Plan change type", {
      currentTier: currentTierName,
      currentInterval,
      newTier,
      newInterval: billingInterval,
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
        items: [{ id: subscription.items.data[0].id, price: targetPriceId }],
        proration_behavior: "always_invoice",
        metadata: {
          ...subscription.metadata,
          tier: newTier,
          interval: billingInterval,
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
        newInterval: billingInterval,
        maxLines: tierConfig.maxLines,
        effectiveImmediately: true,
        message: `Upgraded to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)} plan${billingInterval === "year" ? " (Yearly)" : ""}. Your new limits are active now.`,
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
            items: [{ price: targetPriceId, quantity: 1 }],
            start_date: periodEnd,
            metadata: { tier: newTier, interval: billingInterval },
          },
        ],
      });

      result = {
        success: true,
        changeType: "downgrade",
        newTier,
        newInterval: billingInterval,
        maxLines: tierConfig.maxLines,
        effectiveImmediately: false,
        scheduledDate: nextBillingDateIso,
        message: `Downgrade to ${newTier.charAt(0).toUpperCase() + newTier.slice(1)} plan${billingInterval === "year" ? " (Yearly)" : ""} scheduled. You'll continue on your current plan until ${new Date(nextBillingDateIso).toLocaleDateString()}.`,
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
