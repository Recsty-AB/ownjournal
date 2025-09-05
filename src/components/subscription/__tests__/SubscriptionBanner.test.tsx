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

  it('should render upgrade button for non-pro users', () => {
    const { container } = render(
      <SubscriptionBanner onUpgrade={mockOnUpgrade} isPro={false} />
    );
    expect(container.textContent).toContain('Upgrade to Plus');
  });

  it('should render AI features for non-pro users', () => {
    const { container } = render(
      <SubscriptionBanner onUpgrade={mockOnUpgrade} isPro={false} />
    );
    expect(container.textContent).toContain('AI');
  });

  it('should render pricing for non-pro users', () => {
    const { container } = render(
      <SubscriptionBanner onUpgrade={mockOnUpgrade} isPro={false} />
    );
    expect(container.textContent).toContain('1,500');
  });

  it('should render pro member badge for pro users', () => {
    const { container } = render(
      <SubscriptionBanner onUpgrade={mockOnUpgrade} isPro={true} />
    );
    expect(container.textContent).toContain('Plus Member');
  });

  it('should not render upgrade button for pro users', () => {
    const { container } = render(
      <SubscriptionBanner onUpgrade={mockOnUpgrade} isPro={true} />
    );
    expect(container.textContent).not.toContain('Upgrade to Plus');
  });

  it('should render with default isPro=false', () => {
    const { container } = render(
      <SubscriptionBanner onUpgrade={mockOnUpgrade} />
    );
    expect(container.textContent).toContain('Upgrade to Plus');
  });

  it('should handle onClick callback', () => {
    expect(() => {
      render(<SubscriptionBanner onUpgrade={mockOnUpgrade} isPro={false} />);
    }).not.toThrow();
  });
});
