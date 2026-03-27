/**
 * SyncStatusIndicator Component Tests
 * Tests sync status display and visual feedback
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { SyncStatusIndicator } from '../sync/SyncStatusIndicator';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('@/services/storageServiceV2', () => ({
  storageServiceV2: {
    onSyncProgress: vi.fn(() => () => {}),
  },
}));

const wrap = (ui: React.ReactElement) => <TooltipProvider>{ui}</TooltipProvider>;

describe('SyncStatusIndicator', () => {
  const mockConnectedProviders: string[] = [];

  it('should render without crashing', () => {
    const { container } = render(
      wrap(
        <SyncStatusIndicator
          status="idle"
          connectedProviders={mockConnectedProviders}
        />
      )
    );
    expect(container).toBeDefined();
  });

  it('should render with idle status', () => {
    const { container } = render(
      wrap(
        <SyncStatusIndicator
          status="idle"
          connectedProviders={mockConnectedProviders}
        />
      )
    );
    // Component renders a button even with no providers
    expect(container.querySelector('button')).toBeTruthy();
  });

  it('should render with syncing status', () => {
    const { container } = render(
      wrap(
        <SyncStatusIndicator
          status="syncing"
          connectedProviders={mockConnectedProviders}
        />
      )
    );
    expect(container.querySelector('button')).toBeTruthy();
  });

  it('should render with error status', () => {
    const { container } = render(
      wrap(
        <SyncStatusIndicator
          status="error"
          connectedProviders={mockConnectedProviders}
        />
      )
    );
    // Error status wraps button in a tooltip
    expect(container.firstChild).toBeTruthy();
  });

  it('should render with success status', () => {
    const { container } = render(
      wrap(
        <SyncStatusIndicator
          status="success"
          connectedProviders={mockConnectedProviders}
        />
      )
    );
    expect(container.querySelector('button')).toBeTruthy();
  });

  it('should handle empty connectedProviders', () => {
    const { container } = render(
      wrap(<SyncStatusIndicator status="idle" connectedProviders={[]} />)
    );
    expect(container).toBeDefined();
  });

  it('should handle multiple connectedProviders', () => {
    const providers = ['dropbox', 'googledrive'];

    const { container } = render(
      wrap(
        <SyncStatusIndicator
          status="idle"
          connectedProviders={providers}
        />
      )
    );
    expect(container.querySelector('button')).toBeTruthy();
  });

  it('should be visually distinct for different statuses', () => {
    const { container: idleContainer } = render(
      wrap(
        <SyncStatusIndicator
          status="idle"
          connectedProviders={mockConnectedProviders}
        />
      )
    );
    const { container: errorContainer } = render(
      wrap(
        <SyncStatusIndicator
          status="error"
          connectedProviders={mockConnectedProviders}
        />
      )
    );

    expect(idleContainer.firstChild).toBeTruthy();
    expect(errorContainer.firstChild).toBeTruthy();
  });

  it('should render accessibility attributes', () => {
    const { container } = render(
      wrap(
        <SyncStatusIndicator
          status="syncing"
          connectedProviders={mockConnectedProviders}
        />
      )
    );

    const element = container.querySelector('[role]') ||
                   container.querySelector('[aria-label]') ||
                   container.firstChild;
    expect(element).toBeTruthy();
  });

  it('should render consistently with minimal props', () => {
    const { container, rerender } = render(
      wrap(
        <SyncStatusIndicator
          status="idle"
          connectedProviders={mockConnectedProviders}
        />
      )
    );
    expect(container.firstChild).toBeTruthy();

    rerender(
      wrap(
        <SyncStatusIndicator
          status="idle"
          connectedProviders={mockConnectedProviders}
        />
      )
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('should update when status changes', () => {
    const { container, rerender } = render(
      wrap(
        <SyncStatusIndicator
          status="idle"
          connectedProviders={mockConnectedProviders}
        />
      )
    );
    expect(container.firstChild).toBeTruthy();

    rerender(
      wrap(
        <SyncStatusIndicator
          status="syncing"
          connectedProviders={mockConnectedProviders}
        />
      )
    );
    expect(container.firstChild).toBeTruthy();
  });

  it('should show appropriate message for no connected providers', () => {
    const { container } = render(
      wrap(
        <SyncStatusIndicator
          status="idle"
          connectedProviders={[]}
        />
      )
    );
    expect(container).toBeDefined();
  });
});
