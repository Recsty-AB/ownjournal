import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
    if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) {
      console.error('Missing Stripe configuration');
      return new Response(
        JSON.stringify({ error: 'Stripe webhook not configured' }), 
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    // Get the signature from headers
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      console.error('No stripe-signature header');
      return new Response(JSON.stringify({ error: 'No signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the raw body
    const body = await req.text();

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        body,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Webhook event received:', event.type);

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        if (!userId) {
          console.error('No user_id in session metadata');
          break;
        }

        console.log(`Checkout completed for user ${userId}, subscription ${subscriptionId}`);

        // Retrieve subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Update the subscriptions table
        const { error } = await supabaseAdmin
          .from('subscriptions')
          .update({
            is_pro: true,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            subscription_status: subscription.status,
            plan_name: 'plus',
            current_period_start: subscription.current_period_start 
              ? new Date(subscription.current_period_start * 1000).toISOString() 
              : null,
            current_period_end: subscription.current_period_end 
              ? new Date(subscription.current_period_end * 1000).toISOString() 
              : null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (error) {
          console.error('Failed to update subscription:', error);
        } else {
          console.log(`Successfully activated subscription for user ${userId}`);
        }
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.user_id;

        if (!userId) {
          // Try to find user by customer ID
          const customerId = subscription.customer as string;
          const { data: existingSubscription } = await supabaseAdmin
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();

          if (!existingSubscription?.user_id) {
            console.error('Could not find user for subscription update');
            break;
          }

          const targetUserId = existingSubscription.user_id;

          const isActive = ['active', 'trialing'].includes(subscription.status);

          const updatePayload = {
            is_pro: isActive,
            subscription_status: subscription.status,
            stripe_subscription_id: subscription.id,
            plan_name: 'plus',
            current_period_start: subscription.current_period_start 
              ? new Date(subscription.current_period_start * 1000).toISOString() 
              : null,
            current_period_end: subscription.current_period_end 
              ? new Date(subscription.current_period_end * 1000).toISOString() 
              : null,
            updated_at: new Date().toISOString(),
          };

          console.log(`Updating subscription for user ${targetUserId} (found by customer ID):`, JSON.stringify(updatePayload));

          const { error } = await supabaseAdmin
            .from('subscriptions')
            .update(updatePayload)
            .eq('user_id', targetUserId);

          if (error) {
            console.error('Failed to update subscription:', error);
          } else {
            console.log(`Successfully updated subscription for user ${targetUserId}`);
          }
        } else {
          const isActive = ['active', 'trialing'].includes(subscription.status);

          const updatePayload = {
            is_pro: isActive,
            subscription_status: subscription.status,
            stripe_subscription_id: subscription.id,
            plan_name: 'plus',
            current_period_start: subscription.current_period_start 
              ? new Date(subscription.current_period_start * 1000).toISOString() 
              : null,
            current_period_end: subscription.current_period_end 
              ? new Date(subscription.current_period_end * 1000).toISOString() 
              : null,
            updated_at: new Date().toISOString(),
          };

          console.log(`Updating subscription for user ${userId} (found by metadata):`, JSON.stringify(updatePayload));

          const { error } = await supabaseAdmin
            .from('subscriptions')
            .update(updatePayload)
            .eq('user_id', userId);

          if (error) {
            console.error('Failed to update subscription:', error);
          } else {
            console.log(`Successfully updated subscription for user ${userId}`);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.user_id;
        const customerId = subscription.customer as string;

        // Find user either by metadata or customer ID
        let targetUserId = userId;
        if (!targetUserId) {
          const { data: existingSubscription } = await supabaseAdmin
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_customer_id', customerId)
            .maybeSingle();

          targetUserId = existingSubscription?.user_id;
        }

        if (!targetUserId) {
          console.error('Could not find user for subscription deletion');
          break;
        }

        console.log(`Subscription deleted for user ${targetUserId}`);

        const { error } = await supabaseAdmin
          .from('subscriptions')
          .update({
            is_pro: false,
            subscription_status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', targetUserId);

        if (error) {
          console.error('Failed to update subscription on deletion:', error);
        } else {
          console.log(`Successfully deactivated subscription for user ${targetUserId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in stripe-webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
