import { describe, it, expect } from 'vitest';
import {
  buildUpdate,
  isUUID,
  mapStoreToProvider,
  type RCEvent,
} from '../subscriptionUpdate';

function event(partial: Partial<RCEvent>): RCEvent {
  return {
    id: 'evt_1',
    type: 'INITIAL_PURCHASE',
    app_user_id: '11111111-1111-1111-1111-111111111111',
    store: 'APP_STORE',
    entitlement_ids: ['plus'],
    ...partial,
  };
}

describe('mapStoreToProvider', () => {
  it('maps Apple stores to apple', () => {
    expect(mapStoreToProvider('APP_STORE')).toBe('apple');
    expect(mapStoreToProvider('MAC_APP_STORE')).toBe('apple');
  });
  it('maps Play Store to google', () => {
    expect(mapStoreToProvider('PLAY_STORE')).toBe('google');
  });
  it('returns null for out-of-scope stores', () => {
    expect(mapStoreToProvider('STRIPE')).toBeNull();
    expect(mapStoreToProvider('PROMOTIONAL')).toBeNull();
    expect(mapStoreToProvider(undefined)).toBeNull();
  });
});

describe('isUUID', () => {
  it('accepts a canonical UUID', () => {
    expect(isUUID('11111111-1111-1111-1111-111111111111')).toBe(true);
  });
  it('rejects RevenueCat anonymous ids and undefined', () => {
    expect(isUUID('$RCAnonymousID:abc123')).toBe(false);
    expect(isUUID(undefined)).toBe(false);
  });
});

describe('buildUpdate — entitlement gating', () => {
  it('grants is_pro for a purchase that includes the plus entitlement', () => {
    const u = buildUpdate(event({ type: 'INITIAL_PURCHASE', entitlement_ids: ['plus'] }), 'apple');
    expect(u).not.toBeNull();
    expect(u!.is_pro).toBe(true);
    expect(u!.subscription_status).toBe('active');
  });

  it('ignores a purchase that does not grant the plus entitlement', () => {
    expect(buildUpdate(event({ type: 'INITIAL_PURCHASE', entitlement_ids: ['some_other'] }), 'apple')).toBeNull();
    expect(buildUpdate(event({ type: 'INITIAL_PURCHASE', entitlement_ids: [] }), 'apple')).toBeNull();
    expect(buildUpdate(event({ type: 'INITIAL_PURCHASE', entitlement_ids: null }), 'apple')).toBeNull();
  });

  // Regression: a BILLING_ISSUE for a non-plus product must not flip is_pro on.
  // Previously this case granted is_pro: true unconditionally, unlike every
  // other grant path which gates on the plus entitlement.
  it('does NOT grant is_pro on a BILLING_ISSUE without the plus entitlement', () => {
    expect(buildUpdate(event({ type: 'BILLING_ISSUE', entitlement_ids: ['some_other'] }), 'apple')).toBeNull();
    expect(buildUpdate(event({ type: 'BILLING_ISSUE', entitlement_ids: [] }), 'apple')).toBeNull();
    expect(buildUpdate(event({ type: 'BILLING_ISSUE', entitlement_ids: null }), 'apple')).toBeNull();
  });

  it('keeps entitlement during a BILLING_ISSUE grace period when plus is granted', () => {
    const u = buildUpdate(event({ type: 'BILLING_ISSUE', entitlement_ids: ['plus'] }), 'apple');
    expect(u).not.toBeNull();
    expect(u!.is_pro).toBe(true);
    expect(u!.subscription_status).toBe('past_due');
  });
});

describe('buildUpdate — status transitions', () => {
  it('marks a cancelled-but-active subscription as canceled while keeping is_pro', () => {
    const u = buildUpdate(event({ type: 'CANCELLATION', entitlement_ids: ['plus'] }), 'google');
    expect(u!.is_pro).toBe(true);
    expect(u!.subscription_status).toBe('canceled');
  });

  it('revokes is_pro on EXPIRATION, REFUND and SUBSCRIPTION_PAUSED', () => {
    for (const type of ['EXPIRATION', 'REFUND', 'SUBSCRIPTION_PAUSED'] as const) {
      const u = buildUpdate(event({ type }), 'apple');
      expect(u!.is_pro).toBe(false);
      expect(u!.plan_name).toBe('free');
    }
  });

  it('flags a trial purchase as trialing and records has_used_trial', () => {
    const u = buildUpdate(event({ type: 'INITIAL_PURCHASE', period_type: 'TRIAL' }), 'apple');
    expect(u!.subscription_status).toBe('trialing');
    expect(u!.has_used_trial).toBe(true);
  });

  it('writes provider-specific identifiers', () => {
    const apple = buildUpdate(event({ original_transaction_id: 'oti_9', product_id: 'p_9' }), 'apple');
    expect(apple!.apple_original_transaction_id).toBe('oti_9');
    expect(apple!.apple_product_id).toBe('p_9');

    const google = buildUpdate(event({ transaction_id: 'tok_9', product_id: 'p_9' }), 'google');
    expect(google!.google_purchase_token).toBe('tok_9');
    expect(google!.google_product_id).toBe('p_9');
  });

  it('ignores TEST and NON_RENEWING_PURCHASE events', () => {
    expect(buildUpdate(event({ type: 'TEST' }), 'apple')).toBeNull();
    expect(buildUpdate(event({ type: 'NON_RENEWING_PURCHASE' }), 'apple')).toBeNull();
  });
});
