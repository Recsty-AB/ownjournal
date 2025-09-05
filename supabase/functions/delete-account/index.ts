import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import Stripe from 'https://esm.sh/stripe@14.21.0'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create client with user's JWT
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify the token and get user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      console.error('JWT verification failed:', userError)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const userId = user.id
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID not found in token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing account deletion for user: ${userId}`)

    // Create admin client for deletion operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Step 1: Get subscription info and cancel Stripe subscription if exists
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('user_id', userId)
      .single()

    if (subscription?.stripe_subscription_id) {
      try {
        const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
        if (stripeKey) {
          const stripe = new Stripe(stripeKey, {
            apiVersion: '2023-10-16',
          })
          
          // Cancel the subscription immediately
          await stripe.subscriptions.cancel(subscription.stripe_subscription_id)
          console.log(`Cancelled Stripe subscription: ${subscription.stripe_subscription_id}`)
        }
      } catch (stripeError) {
        // Log but don't fail - we still want to delete the user
        console.error('Failed to cancel Stripe subscription:', stripeError)
      }
    }

    // Step 2: Delete database records (order matters due to potential FK relationships)
    // Delete ai_usage_stats
    const { error: usageError } = await supabaseAdmin
      .from('ai_usage_stats')
      .delete()
      .eq('user_id', userId)
    
    if (usageError) {
      console.error('Failed to delete ai_usage_stats:', usageError)
    }

    // Delete subscriptions
    const { error: subError } = await supabaseAdmin
      .from('subscriptions')
      .delete()
      .eq('user_id', userId)
    
    if (subError) {
      console.error('Failed to delete subscriptions:', subError)
    }

    // Delete profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId)
    
    if (profileError) {
      console.error('Failed to delete profiles:', profileError)
    }

    // Step 3: Delete the user from auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)
    
    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete user account', details: deleteError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Successfully deleted user account: ${userId}`)

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Account deletion error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
