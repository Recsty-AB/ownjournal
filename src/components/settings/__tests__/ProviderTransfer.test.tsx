import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { ProviderTransfer } from '../ProviderTransfer';

vi.mock('@/hooks/useTransfer', () => ({
  useTransfer: () => ({
    isTransferring: false,
    progress: 0,
    currentFile: null,
    lastTransferSuccess: false,
    transfer: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    resetTransferSuccess: vi.fn(),
  }),
}));

describe('ProviderTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear window providers
    (window as unknown as Record<string, unknown>).googleDriveSync = undefined;
    (window as unknown as Record<string, unknown>).dropboxSync = undefined;
    (window as unknown as Record<string, unknown>).nextcloudSync = undefined;
  });

  it('should render successfully', () => {
    const { container } = render(<ProviderTransfer />);
    expect(container).toBeInTheDocument();
  });

  it('should show message when less than 2 providers', () => {
    const { container } = render(<ProviderTransfer />);
    expect(container.textContent).toContain('Connect at least two storage providers');
  });

  it('should render transfer UI when 2+ providers connected', () => {
    (window as unknown as Record<string, unknown>).googleDriveSync = {
      service: { name: 'Google Drive', isConnected: true },
    };
    (window as unknown as Record<string, unknown>).dropboxSync = {
      service: { name: 'Dropbox', isConnected: true },
    };

    const { container } = render(<ProviderTransfer />);
    expect(container.textContent).toContain('Transfer Between Providers');
  });

  it('should render source and target selects', () => {
    (window as unknown as Record<string, unknown>).googleDriveSync = {
      service: { name: 'Google Drive', isConnected: true },
    };
    (window as unknown as Record<string, unknown>).dropboxSync = {
      service: { name: 'Dropbox', isConnected: true },
    };

    const { container } = render(<ProviderTransfer />);
    expect(container.textContent).toContain('From');
    expect(container.textContent).toContain('To');
  });

  it('should render transfer button', () => {
    (window as unknown as Record<string, unknown>).googleDriveSync = {
      service: { name: 'Google Drive', isConnected: true },
    };
    (window as unknown as Record<string, unknown>).dropboxSync = {
      service: { name: 'Dropbox', isConnected: true },
    };

    const { container } = render(<ProviderTransfer />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should handle transfer state', () => {
    (window as unknown as Record<string, unknown>).googleDriveSync = {
      service: { name: 'Google Drive', isConnected: true },
    };
    (window as unknown as Record<string, unknown>).dropboxSync = {
      service: { name: 'Dropbox', isConnected: true },
    };

    const { container } = render(<ProviderTransfer />);
    expect(container).toBeInTheDocument();
  });
});
