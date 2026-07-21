// RevenueCat → Supabase webhook
//
// Receives signed events from RevenueCat for iOS/Android purchases and
// converges them onto the existing public.subscriptions row for the user.
// is_pro is the single source of truth for entitlement; this function sets it
// based on the event type. The same column is read by the web client, so a
// purchase made in the iOS app immediately unlocks Plus on web (and vice
// versa: a Stripe purchase on web unlocks Plus in the iOS app, since both
// providers write the same column).
//
// Auth: Authorization: Bearer <REVENUECAT_WEBHOOK_AUTH>. Set the same value
// in the RevenueCat dashboard under Project Settings → Integrations →
// Webhooks → Authorization header.
//
// Idempotency: every event.id is recorded in public.iap_processed_events
// before the row update; duplicate deliveries are no-ops.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  buildUpdate,
  isUUID,
  mapStoreToProvider,
  type RCWebhookPayload,
} from "./subscriptionUpdate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const expected = Deno.env.get("REVENUECAT_WEBHOOK_AUTH");
  if (!expected) {
    console.error("REVENUECAT_WEBHOOK_AUTH not configured");
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const auth = req.headers.get("authorization") ?? "";
  if (!constantTimeEqual(auth, `Bearer ${expected}`)) {
    console.error("Unauthorized webhook call");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: RCWebhookPayload;
  try {
    payload = await req.json();
  } catch (err) {
    console.error("Invalid JSON body:", err);
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const event = payload.event;
  if (!event?.id || !event.type || !event.app_user_id) {
    return new Response(JSON.stringify({ error: "Malformed event" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`RC webhook: ${event.type} for ${event.app_user_id} (event ${event.id})`);

  if (event.type === "TEST") {
    return new Response(JSON.stringify({ ok: true, ignored: "TEST" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const provider = mapStoreToProvider(event.store);
  if (!provider) {
    // Stripe / RC Billing / Promotional events are out of scope here — Stripe
    // is handled by stripe-webhook; promo entitlements granted via RC dashboard
    // bypass our DB intentionally.
    return new Response(JSON.stringify({ ok: true, ignored: `store=${event.store}` }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!isUUID(event.app_user_id)) {
    console.error(`Non-UUID app_user_id: ${event.app_user_id} — was Purchases.logIn() called with the Supabase user id?`);
    return new Response(JSON.stringify({ ok: true, ignored: "anonymous_user" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  );

  // Pre-check idempotency: if event already processed, return 200 without re-applying.
  // We do not insert here — see below for why ordering matters.
  const { data: existing } = await supabase
    .from("iap_processed_events")
    .select("event_id")
    .eq("event_id", event.id)
    .maybeSingle();

  if (existing) {
    console.log(`Duplicate event ${event.id}, skipping`);
    return new Response(JSON.stringify({ ok: true, duplicate: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const update = buildUpdate(event, provider);
  if (!update) {
    console.log(`Event ${event.type} did not produce a subscription update`);
    // Still record so we don't reprocess on retry.
    await supabase.from("iap_processed_events").insert({
      event_id: event.id,
      provider,
      user_id: event.app_user_id,
      payload: event as unknown as Record<string, unknown>,
    });
    return new Response(JSON.stringify({ ok: true, no_update: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Apply subscription update FIRST. The update is idempotent on retry: same
  // event payload → same column values. If we recorded the event_id before
  // updating and the update then failed, RC would retry, see the event_id as
  // processed, return 200, and leave the row permanently stale.
  const { data: updated, error: updErr } = await supabase
    .from("subscriptions")
    .update(update)
    .eq("user_id", event.app_user_id)
    .select("user_id");

  if (updErr) {
    console.error("Failed to update subscription:", updErr);
    return new Response(JSON.stringify({ error: "DB error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!updated || updated.length === 0) {
    // Auto-create-on-signup trigger should have populated this row. If we get
    // here, either the user doesn't exist (RC sent a stray event) or the
    // trigger raced with the purchase. Log and return 200 — recording the
    // event prevents endless retries.
    console.warn(`No subscription row for user_id=${event.app_user_id}; event ${event.id} dropped`);
  } else {
    console.log(`Applied ${event.type} for ${event.app_user_id} (provider=${provider})`);
  }

  // For TRANSFER, also clear is_pro on any users the subscription was
  // transferred away from. Otherwise the previous owner keeps Plus in our DB
  // forever, even though their entitlement moved to a new account.
  if (event.type === "TRANSFER" && Array.isArray(event.transferred_from)) {
    const previousOwners = event.transferred_from.filter(isUUID);
    if (previousOwners.length > 0) {
      const { error: clearErr } = await supabase
        .from("subscriptions")
        .update({
          is_pro: false,
          subscription_status: "transferred",
          updated_at: new Date().toISOString(),
        })
        .in("user_id", previousOwners);
      if (clearErr) {
        console.error("Failed to clear transferred_from owners:", clearErr);
        // Don't fail the webhook — the new owner update succeeded; the stale
        // old owner is a smaller problem than reprocessing the entire event.
      } else {
        console.log(`Cleared is_pro on ${previousOwners.length} previous owner(s)`);
      }
    }
  }

  // Record event_id last, so a failed update is retried by RC instead of
  // silently dropped. Insert may race with concurrent retries — handle the
  // unique-violation as a benign no-op.
  const { error: recErr } = await supabase
    .from("iap_processed_events")
    .insert({
      event_id: event.id,
      provider,
      user_id: event.app_user_id,
      payload: event as unknown as Record<string, unknown>,
    });

  if (recErr && (recErr as { code?: string }).code !== "23505") {
    console.error("Failed to record processed event:", recErr);
    // The subscription is updated; not recording the event_id only risks one
    // duplicate apply on the next retry, which is itself idempotent. Return 200.
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
