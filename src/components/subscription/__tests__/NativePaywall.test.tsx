import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NativePaywall } from '../NativePaywall';

// Mock iapService — controlled per-test by tweaking the returned mocks below.
const iapMocks = vi.hoisted(() => ({
  getProducts: vi.fn(),
  isEligibleForTrial: vi.fn(),
  purchase: vi.fn(),
  restore: vi.fn(),
}));

const { MockIAPError } = vi.hoisted(() => {
  class MockIAPError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
      this.name = 'IAPError';
    }
  }
  return { MockIAPError };
});

vi.mock('@/services/iapService', () => ({
  iapService: iapMocks,
  IAPError: MockIAPError,
}));

// Capture toast calls to assert on title/variant.
const toastMock = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock, dismiss: vi.fn() }),
  toast: toastMock,
}));

const renderPaywall = (props: { onPurchased?: () => void } = {}) =>
  render(
    <MemoryRouter>
      <NativePaywall {...props} />
    </MemoryRouter>
  );

const defaultProduct = {
  productId: 'app.ownjournal.plus.yearly.v1',
  priceFormatted: '$19.99',
  priceAmountMicros: 19_990_000,
  currencyCode: 'USD',
  introOffer: { kind: 'free_trial' as const, periodDays: 14 },
};

beforeEach(() => {
  vi.clearAllMocks();
  iapMocks.getProducts.mockResolvedValue([defaultProduct]);
  iapMocks.isEligibleForTrial.mockResolvedValue(true);
  iapMocks.purchase.mockResolvedValue({ isPro: true });
  iapMocks.restore.mockResolvedValue({ isPro: false });
});

describe('NativePaywall', () => {
  it('renders trial pricing copy when user is eligible for trial', async () => {
    iapMocks.isEligibleForTrial.mockResolvedValue(true);
    const { container } = renderPaywall();
    await waitFor(() => {
      expect(container.textContent).toContain('subscription.trialPricing');
    });
  });

  it('renders non-trial pricing copy when user is ineligible', async () => {
    iapMocks.isEligibleForTrial.mockResolvedValue(false);
    const { container } = renderPaywall();
    await waitFor(() => {
      expect(container.textContent).toContain('subscription.priceYearly');
    });
  });

  it('shows the iapUnavailable state with a Try again button when no product loads', async () => {
    iapMocks.getProducts.mockResolvedValue([]);
    const { container } = renderPaywall();
    await waitFor(() => {
      expect(container.textContent).toContain('subscription.iapUnavailable');
    });
    // A retry affordance is offered, and the generic purchase-failed copy is NOT
    // used for an init/load failure (that string is reserved for failed purchases).
    expect(screen.getByRole('button', { name: /tryAgain/ })).toBeTruthy();
    expect(container.textContent).not.toContain('subscription.purchaseFailed');
  });

  it('shows the iapUnavailable state when getProducts throws (e.g. init failed)', async () => {
    iapMocks.getProducts.mockRejectedValue(new MockIAPError('NOT_INITIALIZED', 'iapService.init() not called'));
    const { container } = renderPaywall();
    await waitFor(() => {
      expect(container.textContent).toContain('subscription.iapUnavailable');
    });
  });

  it('retries loading the product when Try again is clicked', async () => {
    iapMocks.getProducts.mockResolvedValueOnce([]); // first load fails
    const { container } = renderPaywall();
    await waitFor(() => expect(container.textContent).toContain('subscription.iapUnavailable'));
    iapMocks.getProducts.mockResolvedValue([defaultProduct]); // second load succeeds
    fireEvent.click(screen.getByRole('button', { name: /tryAgain/ }));
    await waitFor(() => expect(container.textContent).toContain('subscription.trialPricing'));
    expect(iapMocks.getProducts).toHaveBeenCalledTimes(2);
  });

  it('renders Privacy and Terms links pointing to /privacy and /terms', async () => {
    renderPaywall();
    await waitFor(() => expect(iapMocks.getProducts).toHaveBeenCalled());
    const links = screen.getAllByRole('link');
    const hrefs = links.map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/privacy');
    expect(hrefs).toContain('/terms');
  });

  it('calls iapService.purchase() when the upgrade button is clicked', async () => {
    renderPaywall();
    await waitFor(() => expect(iapMocks.getProducts).toHaveBeenCalled());
    const upgradeBtn = screen.getByRole('button', { name: /trialCta|upgradeToPro/ });
    fireEvent.click(upgradeBtn);
    await waitFor(() => expect(iapMocks.purchase).toHaveBeenCalledTimes(1));
  });

  it('shows upgradeSuccess toast and calls onPurchased on a successful purchase', async () => {
    iapMocks.purchase.mockResolvedValue({ isPro: true });
    const onPurchased = vi.fn();
    renderPaywall({ onPurchased });
    await waitFor(() => expect(iapMocks.getProducts).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /trialCta|upgradeToPro/ }));
    await waitFor(() => expect(onPurchased).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'subscription.upgradeSuccess',
    }));
  });

  it('shows the purchasePending toast when purchase resolves without isPro', async () => {
    iapMocks.purchase.mockResolvedValue({ isPro: false });
    const onPurchased = vi.fn();
    renderPaywall({ onPurchased });
    await waitFor(() => expect(iapMocks.getProducts).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /trialCta|upgradeToPro/ }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'subscription.purchasePending',
    })));
    expect(onPurchased).not.toHaveBeenCalled();
  });

  it('does NOT show a toast when purchase is cancelled by the user', async () => {
    iapMocks.purchase.mockRejectedValue(new MockIAPError('USER_CANCELLED', 'cancelled'));
    renderPaywall();
    await waitFor(() => expect(iapMocks.getProducts).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /trialCta|upgradeToPro/ }));
    await waitFor(() => expect(iapMocks.purchase).toHaveBeenCalled());
    // Wait one tick for any latent toast call
    await new Promise((r) => setTimeout(r, 0));
    expect(toastMock).not.toHaveBeenCalled();
  });

  it('shows the purchaseFailed toast on non-cancellation purchase errors', async () => {
    iapMocks.purchase.mockRejectedValue(new MockIAPError('UNKNOWN', 'something broke'));
    renderPaywall();
    await waitFor(() => expect(iapMocks.getProducts).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /trialCta|upgradeToPro/ }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'destructive',
      title: 'subscription.purchaseFailed',
    })));
  });

  it('clicking Restore calls iapService.restore() and toasts restoreSuccess on isPro:true', async () => {
    iapMocks.restore.mockResolvedValue({ isPro: true });
    const onPurchased = vi.fn();
    renderPaywall({ onPurchased });
    await waitFor(() => expect(iapMocks.getProducts).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /restorePurchases/ }));
    await waitFor(() => expect(iapMocks.restore).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'subscription.restoreSuccess',
    }));
    expect(onPurchased).toHaveBeenCalled();
  });

  it('clicking Restore toasts restoreNothing when there is nothing to restore', async () => {
    iapMocks.restore.mockResolvedValue({ isPro: false });
    renderPaywall();
    await waitFor(() => expect(iapMocks.getProducts).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /restorePurchases/ }));
    await waitFor(() => expect(iapMocks.restore).toHaveBeenCalled());
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      title: 'subscription.restoreNothing',
    }));
  });

  it('clicking Restore toasts restoreFailed on error', async () => {
    iapMocks.restore.mockRejectedValue(new Error('network down'));
    renderPaywall();
    await waitFor(() => expect(iapMocks.getProducts).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /restorePurchases/ }));
    await waitFor(() => expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      variant: 'destructive',
      title: 'subscription.restoreFailed',
    })));
  });
});
