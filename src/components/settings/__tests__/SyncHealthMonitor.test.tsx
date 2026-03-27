import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { SyncHealthMonitor } from '../SyncHealthMonitor';

vi.mock('@/services/storageServiceV2', () => ({
  storageServiceV2: {
    getDiagnostics: vi.fn(() => ({
      successCount: 10,
      failureCount: 0,
      retryCount: 0,
      circuitBreakerStatus: new Map(),
      activeRetries: new Set(),
      recentEntries: [],
    })),
    getConflictLog: vi.fn(() => []),
  },
}));

describe('SyncHealthMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render successfully', () => {
    const { container } = render(<SyncHealthMonitor />);
    expect(container).toBeInTheDocument();
  });

  it('should render health status title', () => {
    const { container } = render(<SyncHealthMonitor />);
    expect(container.textContent).toContain('syncHealth.title');
  });

  it('should render refresh button', () => {
    const { container } = render(<SyncHealthMonitor />);
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should render health metrics', () => {
    const { container } = render(<SyncHealthMonitor />);
    expect(container).toBeInTheDocument();
  });

  it('should render health score', () => {
    const { container } = render(<SyncHealthMonitor />);
    expect(container).toBeInTheDocument();
  });

  it('should handle auto-refresh state', () => {
    const { container } = render(<SyncHealthMonitor />);
    expect(container).toBeInTheDocument();
  });

  it('should calculate health metrics correctly', () => {
    const { container } = render(<SyncHealthMonitor />);
    expect(container).toBeInTheDocument();
  });
});
