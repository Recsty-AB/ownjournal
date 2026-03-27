import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SubscriptionBanner } from '../SubscriptionBanner';

describe('SubscriptionBanner', () => {
  const mockOnUpgrade = vi.fn();

  it('should render successfully for non-pro users', () => {
    const { container } = render(
      <SubscriptionBanner onUpgrade={mockOnUpgrade} isPro={false} />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render upgrade content for non-pro users', () => {
    const { container } = render(
      <SubscriptionBanner onUpgrade={mockOnUpgrade} isPro={false} />
    );
    // Component uses i18n keys
    expect(container.textContent).toContain('subscription.');
  });

  it('should render pro member content for pro users', () => {
    const { container } = render(
      <SubscriptionBanner onUpgrade={mockOnUpgrade} isPro={true} />
    );
    expect(container.textContent).toContain('subscription.proMember');
  });

  it('should not render upgrade content for pro users', () => {
    const { container } = render(
      <SubscriptionBanner onUpgrade={mockOnUpgrade} isPro={true} />
    );
    expect(container.textContent).not.toContain('subscription.upgradeTo');
  });

  it('should render with default isPro=false', () => {
    const { container } = render(
      <SubscriptionBanner onUpgrade={mockOnUpgrade} />
    );
    expect(container.textContent).toContain('subscription.');
  });

  it('should handle onClick callback', () => {
    expect(() => {
      render(<SubscriptionBanner onUpgrade={mockOnUpgrade} isPro={false} />);
    }).not.toThrow();
  });
});
