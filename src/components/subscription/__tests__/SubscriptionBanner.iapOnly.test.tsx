import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { SubscriptionBanner } from '../SubscriptionBanner';
import { useIapOnlyRegion } from '@/hooks/useIapOnlyRegion';

// Web/desktop platform so the Stripe CTA path is reachable; the IAP-only
// notice replaces it only for UK VAT / NETP regions.
vi.mock('@/utils/platformDetection', () => ({
  canShowStripeCheckout: () => true,
}));

vi.mock('@/hooks/useLocalizedPricing', () => ({
  useLocalizedPricing: () => ({
    currency: 'USD',
    yearlyPrice: '$19.99',
    monthlyPrice: '$1.67',
    yearlyAmount: 1999,
    monthlyAmount: 167,
    isDetecting: false,
  }),
}));

vi.mock('@/hooks/useIapOnlyRegion', () => ({
  useIapOnlyRegion: vi.fn(),
}));

const mockUseIapOnlyRegion = vi.mocked(useIapOnlyRegion);

describe('SubscriptionBanner — UK VAT / NETP routing', () => {
  const onUpgrade = vi.fn();

  beforeEach(() => {
    onUpgrade.mockClear();
  });

  it('shows the store-redirect notice (not Stripe) for an IAP-only region', () => {
    mockUseIapOnlyRegion.mockReturnValue({ isIapOnly: true, isLoading: false, country: 'GB' });
    const { container } = render(<SubscriptionBanner onUpgrade={onUpgrade} isPro={false} />);

    // Google Play link is present...
    const playLink = container.querySelector('a[href*="play.google.com"]');
    expect(playLink).not.toBeNull();
    expect(container.textContent).toContain('subscription.iapOnly.getOnPlay');

    // ...and the Stripe upgrade button is NOT.
    expect(container.textContent).not.toContain('subscription.upgradeToPro');
    expect(container.textContent).not.toContain('subscription.trialCta');
  });

  it('shows the Stripe upgrade CTA (not the store notice) for a non-IAP-only region', () => {
    mockUseIapOnlyRegion.mockReturnValue({ isIapOnly: false, isLoading: false, country: 'US' });
    const { container } = render(<SubscriptionBanner onUpgrade={onUpgrade} isPro={false} hasUsedTrial={true} />);

    expect(container.querySelector('a[href*="play.google.com"]')).toBeNull();
    expect(container.textContent).toContain('subscription.upgradeToPro');
  });

  it('shows neither CTA while region detection is loading (no Stripe flash)', () => {
    mockUseIapOnlyRegion.mockReturnValue({ isIapOnly: false, isLoading: true, country: null });
    const { container } = render(<SubscriptionBanner onUpgrade={onUpgrade} isPro={false} />);

    expect(container.querySelector('a[href*="play.google.com"]')).toBeNull();
    expect(container.textContent).not.toContain('subscription.upgradeToPro');
    expect(container.textContent).not.toContain('subscription.trialCta');
  });
});
