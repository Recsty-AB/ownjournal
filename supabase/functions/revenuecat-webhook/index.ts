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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RCStore =
  | "APP_STORE"
  | "MAC_APP_STORE"
  | "PLAY_STORE"
  | "STRIPE"
  | "PROMOTIONAL"
  | "AMAZON"
  | "RC_BILLING"
  | string;

type RCEventType =
  | "INITIAL_PURCHASE"
  | "RENEWAL"
  | "UNCANCELLATION"
  | "CANCELLATION"
  | "EXPIRATION"
  | "BILLING_ISSUE"
  | "PRODUCT_CHANGE"
  | "REFUND"
  | "SUBSCRIPTION_PAUSED"
  | "SUBSCRIPTION_EXTENDED"
  | "TRANSFER"
  | "NON_RENEWING_PURCHASE"
  | "TEST"
  | string;

interface RCEvent {
  id: string;
  type: RCEventType;
  app_user_id: string;
  original_app_user_id?: string;
  aliases?: string[];
  store?: RCStore;
  product_id?: string;
  entitlement_ids?: string[] | null;
  period_type?: "NORMAL" | "TRIAL" | "INTRO" | "PROMOTIONAL" | string;
  purchased_at_ms?: number;
  expiration_at_ms?: number | null;
  transaction_id?: string;
  original_transaction_id?: string;
  transferred_from?: string[];
  transferred_to?: string[];
}

interface RCWebhookPayload {
  api_version?: string;
  event: RCEvent;
}

const PLUS_ENTITLEMENT_ID = "plus";

function mapStoreToProvider(store: RCStore | undefined): "apple" | "google" | null {
  if (store === "APP_STORE" || store === "MAC_APP_STORE") return "apple";
  if (store === "PLAY_STORE") return "google";
  return null;
}

function isUUID(s: string | undefined): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function ts(ms: number | null | undefined): string | null {
  if (!ms) return null;
  return new Date(ms).toISOString();
}

interface SubscriptionUpdate {
  is_pro?: boolean;
  subscription_status?: string;
  plan_name?: string;
  current_period_start?: string | null;
  current_period_end?: string | null;
  provider?: "apple" | "google";
  apple_original_transaction_id?: string | null;
  apple_product_id?: string | null;
  google_purchase_token?: string | null;
  google_product_id?: string | null;
  revenuecat_app_user_id?: string;
  last_provider_event_at?: string;
  last_provider_event_id?: string;
  has_used_trial?: boolean;
  updated_at: string;
}

/**
 * Build the partial subscription update for a given RC event.
 * Returns null if the event should be ignored (e.g. wrong store, wrong entitlement).
 */
function buildUpdate(event: RCEvent, provider: "apple" | "google"): SubscriptionUpdate | null {
  const ent = event.entitlement_ids ?? [];
  const grantsPlus = ent.includes(PLUS_ENTITLEMENT_ID);

  const base: SubscriptionUpdate = {
    provider,
    revenuecat_app_user_id: event.app_user_id,
    last_provider_event_at: new Date().toISOString(),
    last_provider_event_id: event.id,
    plan_name: "plus",
    updated_at: new Date().toISOString(),
  };

  if (provider === "apple") {
    base.apple_original_transaction_id = event.original_transaction_id ?? event.transaction_id ?? null;
    base.apple_product_id = event.product_id ?? null;
  } else {
    base.google_purchase_token = event.transaction_id ?? null;
    base.google_product_id = event.product_id ?? null;
  }

  const periodStart = ts(event.purchased_at_ms);
  const periodEnd = ts(event.expiration_at_ms);

  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
    case "SUBSCRIPTION_EXTENDED":
    case "TRANSFER": {
      if (!grantsPlus) return null;
      const isTrial = event.period_type === "TRIAL" || event.period_type === "INTRO";
      return {
        ...base,
        is_pro: true,
        subscription_status: isTrial ? "trialing" : "active",
        current_period_start: periodStart,
        current_period_end: periodEnd,
        ...(isTrial && { has_used_trial: true }),
      };
    }
    case "CANCELLATION": {
      // User cancelled but entitlement remains active until expiration_at_ms.
      // Keep is_pro=true; flip status to indicate non-renewal.
      if (!grantsPlus) return null;
      return {
        ...base,
        is_pro: true,
        subscription_status: "canceled",
        current_period_end: periodEnd,
      };
    }
    case "BILLING_ISSUE": {
      // Payment failed; user is in grace period. Keep entitlement.
      return {
        ...base,
        is_pro: true,
        subscription_status: "past_due",
        current_period_end: periodEnd,
      };
    }
    case "EXPIRATION":
    case "REFUND":
    case "SUBSCRIPTION_PAUSED": {
      return {
        ...base,
        is_pro: false,
        subscription_status: event.type === "REFUND" ? "refunded"
                          : event.type === "SUBSCRIPTION_PAUSED" ? "paused"
                          : "expired",
        current_period_end: periodEnd,
      };
    }
    case "PRODUCT_CHANGE": {
      // Plan switch (e.g. monthly→yearly). Keep current is_pro state by leaving it unset.
      return base;
    }
    case "NON_RENEWING_PURCHASE":
    case "TEST":
    default:
      return null;
  }
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

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
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
