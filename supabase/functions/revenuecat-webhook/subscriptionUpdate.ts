// Pure entitlement-mapping logic for the RevenueCat webhook.
//
// Extracted from index.ts so it can be unit-tested without the Deno HTTP
// runtime. This module intentionally has no Deno or network imports — it is
// pure data-in / data-out and is exercised by ./__tests__/subscriptionUpdate.test.ts.

export type RCStore =
  | "APP_STORE"
  | "MAC_APP_STORE"
  | "PLAY_STORE"
  | "STRIPE"
  | "PROMOTIONAL"
  | "AMAZON"
  | "RC_BILLING"
  | string;

export type RCEventType =
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

export interface RCEvent {
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

export interface RCWebhookPayload {
  api_version?: string;
  event: RCEvent;
}

export const PLUS_ENTITLEMENT_ID = "plus";

export function mapStoreToProvider(store: RCStore | undefined): "apple" | "google" | null {
  if (store === "APP_STORE" || store === "MAC_APP_STORE") return "apple";
  if (store === "PLAY_STORE") return "google";
  return null;
}

export function isUUID(s: string | undefined): s is string {
  return typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export function ts(ms: number | null | undefined): string | null {
  if (!ms) return null;
  return new Date(ms).toISOString();
}

export interface SubscriptionUpdate {
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
export function buildUpdate(event: RCEvent, provider: "apple" | "google"): SubscriptionUpdate | null {
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
      // Only events that actually grant the Plus entitlement may set is_pro,
      // consistent with the purchase/cancellation paths above. A BILLING_ISSUE
      // for any other product must not flip is_pro on.
      if (!grantsPlus) return null;
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
        plan_name: "free",
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
