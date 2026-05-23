import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Stripe only accepts specific locale codes - map app locales to supported ones
const STRIPE_SUPPORTED_LOCALES = [
  'auto', 'bg', 'cs', 'da', 'de', 'el', 'en', 'en-GB', 'es', 'es-419',
  'et', 'fi', 'fil', 'fr', 'fr-CA', 'hr', 'hu', 'id', 'it', 'ja', 'ko',
  'lt', 'lv', 'ms', 'mt', 'nb', 'nl', 'pl', 'pt', 'pt-BR', 'ro', 'ru',
  'sk', 'sl', 'sv', 'th', 'tr', 'vi', 'zh', 'zh-HK', 'zh-TW'
];

function getStripeLocale(appLocale: string): string {
  // Direct match (e.g., 'en', 'ja', 'de')
  if (STRIPE_SUPPORTED_LOCALES.includes(appLocale)) {
    return appLocale;
  }
  // Handle variants (e.g., 'zh-CN' -> 'zh', 'en-US' -> 'en')
  const baseLocale = appLocale.split('-')[0];
  if (STRIPE_SUPPORTED_LOCALES.includes(baseLocale)) {
    return baseLocale;
  }
  // Fallback to auto for unsupported locales (e.g., 'hi')
  return 'auto';
}

// Map currencies to their respective Stripe price IDs
const CURRENCY_PRICE_IDS: Record<string, string | undefined> = {
  USD: Deno.env.get('STRIPE_PRICE_ID_USD') || Deno.env.get('STRIPE_PRICE_ID'),
  EUR: Deno.env.get('STRIPE_PRICE_ID_EUR'),
  GBP: Deno.env.get('STRIPE_PRICE_ID_GBP'),
  JPY: Deno.env.get('STRIPE_PRICE_ID_JPY'),
  CAD: Deno.env.get('STRIPE_PRICE_ID_CAD'),
  SEK: Deno.env.get('STRIPE_PRICE_ID_SEK'),
  NOK: Deno.env.get('STRIPE_PRICE_ID_NOK'),
  DKK: Deno.env.get('STRIPE_PRICE_ID_DKK'),
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
    const DEFAULT_PRICE_ID = Deno.env.get('STRIPE_PRICE_ID');
    
    if (!STRIPE_SECRET_KEY || !DEFAULT_PRICE_ID) {
      console.error('Missing Stripe configuration');
      return new Response(
        JSON.stringify({ error: 'Stripe not configured. Please contact support.' }), 
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('No valid auth header');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Validate the JWT token using getUser()
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('Token validation failed:', userError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract user info
    const userId = user.id;
    const userEmail = user.email;

    if (!userId || !userEmail) {
      console.error('Missing user info');
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Authenticated user:', userId, userEmail);

    // Initialize Stripe
    const stripe = new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });

    // Get or create Stripe customer using admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if user already has a Stripe customer ID
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .maybeSingle();

    let stripeCustomerId = subscription?.stripe_customer_id;

    // Validate existing customer ID or create new one
    if (stripeCustomerId) {
      // Verify the stored customer still exists in Stripe
      try {
        const customer = await stripe.customers.retrieve(stripeCustomerId);
        // Check if customer was deleted (Stripe returns deleted customers with deleted: true)
        if (customer.deleted) {
          console.log('Stored customer was deleted in Stripe, will create new customer');
          stripeCustomerId = null;
        } else {
          console.log('Verified existing Stripe customer:', stripeCustomerId);
        }
      } catch (customerError: any) {
        if (customerError?.code === 'resource_missing') {
          console.log('Stored customer ID no longer valid, will create new customer');
          stripeCustomerId = null;
        } else {
          throw customerError;
        }
      }
    }

    if (!stripeCustomerId) {
      // Adopt an existing Stripe customer ONLY when its metadata explicitly
      // identifies this Supabase user. Adopting by email alone is unsafe:
      // a different person who happens to share the same email (legacy
      // customer, post-migration record, support-created record) would
      // silently grant their entitlement state to this user.
      const existingCustomers = await stripe.customers.list({
        email: userEmail,
        limit: 100,
      });

      const owned = existingCustomers.data.find(
        (c) => c.metadata?.user_id === userId,
      );

      if (owned) {
        stripeCustomerId = owned.id;
        console.log('Adopted existing Stripe customer (metadata match):', stripeCustomerId);
      } else {
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: {
            user_id: userId,
          },
        });
        stripeCustomerId = customer.id;
        console.log('Created new Stripe customer:', stripeCustomerId);
      }

      // Update the customer ID in database
      await supabaseAdmin
        .from('subscriptions')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('user_id', userId);
    }

    // Check if the customer already has an active or trialing subscription in Stripe
    const [activeSubscriptions, trialingSubscriptions] = await Promise.all([
      stripe.subscriptions.list({ customer: stripeCustomerId, status: 'active', limit: 1 }),
      stripe.subscriptions.list({ customer: stripeCustomerId, status: 'trialing', limit: 1 }),
    ]);

    const existingSub = activeSubscriptions.data[0] || trialingSubscriptions.data[0];

    if (existingSub) {
      console.log('User already has active subscription:', existingSub.id, 'status:', existingSub.status);

      // is_pro / subscription_status / period fields are written exclusively
      // by stripe-webhook so that there is a single source of truth and no
      // race between checkout and webhook deliveries. If the DB looks stale,
      // resend the latest event from the Stripe dashboard instead.
      return new Response(
        JSON.stringify({ alreadyActive: true }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse the request body for origin URL and locale
    const body = await req.json().catch(() => ({}));
    const origin = body.origin || 'https://ownjournal.app';
    const stripeLocale = getStripeLocale(body.locale || 'auto');
    const requestedCurrency = body.currency || 'USD';
    const requestTrial = body.trial === true;

    // Check trial eligibility (flag is only set in webhook when trial actually starts)
    let eligibleForTrial = false;
    if (requestTrial) {
      const { data: trialRecord } = await supabaseAdmin
        .from('subscriptions')
        .select('has_used_trial')
        .eq('user_id', userId)
        .maybeSingle();

      eligibleForTrial = !trialRecord?.has_used_trial;
    }
    
    // Select the appropriate price ID based on requested currency
    const priceId = CURRENCY_PRICE_IDS[requestedCurrency] || DEFAULT_PRICE_ID;
    
    console.log('Locale mapping:', body.locale, '->', stripeLocale);
    console.log('Currency requested:', requestedCurrency, '-> Price ID:', priceId);

    // Create Stripe Checkout session
    // Note: Currency is determined by the price configuration in Stripe
    // Do NOT pass currency parameter as it conflicts with existing customer currency
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      locale: stripeLocale,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      automatic_tax: {
        enabled: true,
      },
      customer_update: {
        address: 'auto',
      },
      success_url: `${origin}/checkout-success`,
      cancel_url: `${origin}/checkout-cancel`,
      metadata: {
        user_id: userId,
      },
      subscription_data: {
        metadata: {
          user_id: userId,
        },
        ...(eligibleForTrial && { trial_period_days: 14 }),
      },
    });

    console.log('Checkout session created:', session.id);

    return new Response(
      JSON.stringify({ url: session.url, trial: eligibleForTrial }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in create-checkout:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
