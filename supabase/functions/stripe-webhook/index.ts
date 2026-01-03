import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
  
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    
    // For now, we'll process without signature verification
    // In production, you should set up STRIPE_WEBHOOK_SECRET and verify
    const event = JSON.parse(body) as Stripe.Event;
    
    logStep("Webhook received", { type: event.type, id: event.id });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        logStep("Checkout completed", { 
          sessionId: session.id, 
          customerId: session.customer,
          factoryId: session.metadata?.factory_id 
        });
        
        if (session.metadata?.factory_id && session.subscription) {
          await supabaseAdmin
            .from('factory_accounts')
            .update({
              stripe_customer_id: session.customer as string,
              stripe_subscription_id: session.subscription as string,
              subscription_status: 'active',
              payment_failed_at: null,
            })
            .eq('id', session.metadata.factory_id);
          
          logStep("Factory updated to active");
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription updated", { 
          subscriptionId: subscription.id, 
          status: subscription.status,
          factoryId: subscription.metadata?.factory_id 
        });
        
        if (subscription.metadata?.factory_id) {
          const status = subscription.status === 'active' ? 'active' : 
                        subscription.status === 'trialing' ? 'trial' :
                        subscription.status === 'past_due' ? 'past_due' :
                        subscription.status === 'canceled' ? 'canceled' : 'inactive';
          
          await supabaseAdmin
            .from('factory_accounts')
            .update({ subscription_status: status })
            .eq('id', subscription.metadata.factory_id);
          
          logStep("Factory status updated", { status });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        logStep("Subscription deleted", { 
          subscriptionId: subscription.id,
          factoryId: subscription.metadata?.factory_id 
        });
        
        if (subscription.metadata?.factory_id) {
          // Get factory info for notification
          const { data: factory } = await supabaseAdmin
            .from('factory_accounts')
            .select('name')
            .eq('id', subscription.metadata.factory_id)
            .single();
          
          await supabaseAdmin
            .from('factory_accounts')
            .update({ 
              subscription_status: 'canceled',
              stripe_subscription_id: null 
            })
            .eq('id', subscription.metadata.factory_id);
          
          logStep("Factory subscription canceled");
          
          // Send cancellation notification
          try {
            const { data: admins } = await supabaseAdmin
              .from('profiles')
              .select('email')
              .eq('factory_id', subscription.metadata.factory_id);
            
            if (admins && admins.length > 0) {
              const notificationUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-billing-notification`;
              await fetch(notificationUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
                },
                body: JSON.stringify({
                  type: 'subscription_canceled',
                  factoryId: subscription.metadata.factory_id,
                  email: admins[0].email,
                  factoryName: factory?.name,
                }),
              });
              logStep("Cancellation notification sent");
            }
          } catch (notifError) {
            logStep("Failed to send notification", { error: String(notifError) });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment failed", { 
          invoiceId: invoice.id,
          customerId: invoice.customer 
        });
        
        // Find factory by customer ID
        const { data: factory } = await supabaseAdmin
          .from('factory_accounts')
          .select('id, name')
          .eq('stripe_customer_id', invoice.customer as string)
          .single();
        
        if (factory) {
          await supabaseAdmin
            .from('factory_accounts')
            .update({ 
              subscription_status: 'past_due',
              payment_failed_at: new Date().toISOString()
            })
            .eq('id', factory.id);
          
          logStep("Factory marked as past due");
          
          // Send payment failed notification
          try {
            // Get admin emails
            const { data: admins } = await supabaseAdmin
              .from('profiles')
              .select('email')
              .eq('factory_id', factory.id);
            
            if (admins && admins.length > 0) {
              // Call the notification function
              const notificationUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-billing-notification`;
              await fetch(notificationUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
                },
                body: JSON.stringify({
                  type: 'payment_failed',
                  factoryId: factory.id,
                  email: admins[0].email,
                  factoryName: factory.name,
                }),
              });
              logStep("Payment failed notification sent");
            }
          } catch (notifError) {
            logStep("Failed to send notification", { error: String(notifError) });
          }
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        logStep("Payment succeeded", { 
          invoiceId: invoice.id,
          customerId: invoice.customer 
        });
        
        // Find factory by customer ID
        const { data: factory } = await supabaseAdmin
          .from('factory_accounts')
          .select('id')
          .eq('stripe_customer_id', invoice.customer as string)
          .single();
        
        if (factory) {
          await supabaseAdmin
            .from('factory_accounts')
            .update({ 
              subscription_status: 'active',
              payment_failed_at: null
            })
            .eq('id', factory.id);
          
          logStep("Factory subscription reactivated");
        }
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    });
  }
});
