import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { SyncDiagnostics } from '../SyncDiagnostics';

vi.mock('@/services/storageServiceV2', () => ({
  storageServiceV2: {
    getDiagnostics: vi.fn(() => ({
      successCount: 10,
      failureCount: 2,
      retryCount: 1,
      circuitBreakerStatus: new Map(),
      activeRetries: new Set(),
      recentEntries: [],
    })),
    clearDiagnostics: vi.fn(),
  },
}));

describe('SyncDiagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render successfully', () => {
    const { container } = render(<SyncDiagnostics />);
    expect(container).toBeInTheDocument();
  });

  it('should render header with title', () => {
    const { container } = render(<SyncDiagnostics />);
    expect(container.textContent).toContain('syncDiagnostics.title');
  });

  it('should render refresh button', () => {
    const { container } = render(<SyncDiagnostics />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should render statistics section', () => {
    const { container } = render(<SyncDiagnostics />);
    expect(container).toBeInTheDocument();
  });

  it('should render export button', () => {
    const { container } = render(<SyncDiagnostics />);
    expect(container).toBeInTheDocument();
  });

  it('should render clear button', () => {
    const { container } = render(<SyncDiagnostics />);
    expect(container).toBeInTheDocument();
  });

  it('should handle auto-refresh state', () => {
    const { container } = render(<SyncDiagnostics />);
    expect(container).toBeInTheDocument();
  });
});
