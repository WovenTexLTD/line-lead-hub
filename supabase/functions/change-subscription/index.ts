import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHANGE-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
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
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { newPriceId } = await req.json();
    if (!newPriceId) throw new Error("New price ID is required");
    logStep("Request body", { newPriceId });

    // Get user's factory
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('factory_id')
      .eq('id', user.id)
      .single();

    if (!profile?.factory_id) {
      throw new Error("No factory associated with user");
    }

    // Get factory subscription info
    const { data: factory } = await supabaseClient
      .from('factory_accounts')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('id', profile.factory_id)
      .single();

    if (!factory?.stripe_subscription_id) {
      throw new Error("No active subscription found");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get current subscription
    const subscription = await stripe.subscriptions.retrieve(factory.stripe_subscription_id);
    logStep("Current subscription", { 
      id: subscription.id, 
      status: subscription.status,
      itemId: subscription.items.data[0]?.id 
    });

    // Update subscription with prorated billing
    const updatedSubscription = await stripe.subscriptions.update(factory.stripe_subscription_id, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'create_prorations',
    });

    logStep("Subscription updated", { 
      id: updatedSubscription.id, 
      newPriceId,
      status: updatedSubscription.status 
    });

    // Update factory record
    const newPrice = await stripe.prices.retrieve(newPriceId);
    const productId = typeof newPrice.product === 'string' ? newPrice.product : newPrice.product.id;
    
    // Map product to tier
    let tierName = 'professional';
    if (productId.includes('starter') || newPrice.unit_amount === 15000) {
      tierName = 'starter';
    } else if (productId.includes('enterprise') || newPrice.unit_amount === 75000) {
      tierName = 'enterprise';
    }

    await supabaseClient
      .from('factory_accounts')
      .update({ subscription_tier: tierName })
      .eq('id', profile.factory_id);

    return new Response(JSON.stringify({ 
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        currentPeriodEnd: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
