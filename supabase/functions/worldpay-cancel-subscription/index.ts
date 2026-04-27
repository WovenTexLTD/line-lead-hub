import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/security.ts";
import { deleteToken } from "../_shared/worldpay.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WORLDPAY-CANCEL] ${step}${detailsStr}`);
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

    // Verify admin/owner role
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role, factory_id')
      .eq('user_id', user.id)
      .in('role', ['admin', 'owner', 'superadmin']);

    if (!roles?.length) {
      throw new Error("Only admin or owner can cancel subscriptions");
    }

    const factoryId = roles[0].factory_id;
    if (!factoryId) throw new Error("No factory associated with user");
    logStep("Authorization verified", { role: roles[0].role, factoryId });

    // Get factory details
    const { data: factory } = await supabaseAdmin
      .from('factory_accounts')
      .select('worldpay_token_href, payment_provider, subscription_status')
      .eq('id', factoryId)
      .single();

    if (!factory) throw new Error("Factory not found");
    if (factory.payment_provider !== 'worldpay') {
      throw new Error("This factory is not using Worldpay billing");
    }

    // Delete stored token from Worldpay
    if (factory.worldpay_token_href) {
      logStep("Deleting Worldpay token");
      try {
        await deleteToken(factory.worldpay_token_href);
        logStep("Token deleted");
      } catch (tokenError) {
        logStep("Token deletion failed (may already be deleted)", {
          error: (tokenError as Error).message,
        });
      }
    }

    // Update factory account
    const { error: updateError } = await supabaseAdmin
      .from('factory_accounts')
      .update({
        subscription_status: 'canceled',
        worldpay_token_href: null,
        worldpay_scheme_reference: null,
        billing_cycle_anchor: null,
      })
      .eq('id', factoryId);

    if (updateError) throw new Error(`Failed to update factory: ${updateError.message}`);
    logStep("Factory subscription canceled");

    // Notify all factory users
    const { data: factoryUsers } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('factory_id', factoryId);

    if (factoryUsers?.length) {
      const notifications = factoryUsers.map((u: { user_id: string }) => ({
        user_id: u.user_id,
        title: 'Subscription Canceled',
        message: 'Your factory subscription has been canceled. Access will be limited.',
        type: 'billing',
      }));
      await supabaseAdmin.from('notifications').insert(notifications);
    }

    // Send cancellation email via existing function
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
            type: 'subscription_canceled',
          }),
        }
      );
    } catch (_) { /* notification failure is non-blocking */ }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    logStep("Error", { message: (error as Error).message });
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
