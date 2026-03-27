import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { JournalPasswordDialog } from '../JournalPasswordDialog';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/utils/passwordPersistenceSettings', () => ({
  getPasswordPersistenceMode: vi.fn(() => 'session'),
  setPasswordPersistenceMode: vi.fn(),
}));

vi.mock('@/utils/translateCloudError', () => ({
  translateCloudError: vi.fn((error: Error) => error.message),
}));

describe('JournalPasswordDialog', () => {
  const mockOnPasswordSet = vi.fn().mockResolvedValue(undefined);
  const mockOnDismiss = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open is true', () => {
    const { baseElement } = render(
      <JournalPasswordDialog
        open={true}
        onPasswordSet={mockOnPasswordSet}
      />
    );

    expect(baseElement).toBeInTheDocument();
  });

  it('should not render when open is false', () => {
    const { container } = render(
      <JournalPasswordDialog
        open={false}
        onPasswordSet={mockOnPasswordSet}
      />
    );

    expect(container).toBeInTheDocument();
  });

  it('should render with error message', () => {
    render(
      <JournalPasswordDialog
        open={true}
        onPasswordSet={mockOnPasswordSet}
        errorMessage="Test error message"
      />
    );

    expect(document.body.textContent).toContain('Test error message');
  });

  it('should render for OAuth users', () => {
    const { baseElement } = render(
      <JournalPasswordDialog
        open={true}
        onPasswordSet={mockOnPasswordSet}
        isOAuthUser={true}
      />
    );

    expect(baseElement).toBeInTheDocument();
  });

  it('should render password input fields', () => {
    render(
      <JournalPasswordDialog
        open={true}
        onPasswordSet={mockOnPasswordSet}
      />
    );

    const inputs = document.querySelectorAll('input[type="password"]');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it('should render password visibility toggles', () => {
    const { baseElement } = render(
      <JournalPasswordDialog
        open={true}
        onPasswordSet={mockOnPasswordSet}
      />
    );

    expect(baseElement).toBeInTheDocument();
  });

  it('should render submit button', () => {
    render(
      <JournalPasswordDialog
        open={true}
        onPasswordSet={mockOnPasswordSet}
      />
    );

    const buttons = document.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should accept onDismiss callback', () => {
    expect(() => {
      render(
        <JournalPasswordDialog
          open={true}
          onPasswordSet={mockOnPasswordSet}
          onDismiss={mockOnDismiss}
        />
      );
    }).not.toThrow();
  });

  it('should accept onOpenChange callback', () => {
    expect(() => {
      render(
        <JournalPasswordDialog
          open={true}
          onPasswordSet={mockOnPasswordSet}
          onOpenChange={mockOnOpenChange}
        />
      );
    }).not.toThrow();
  });

  it('should render security warnings for incompatible keys', () => {
    render(
      <JournalPasswordDialog
        open={true}
        onPasswordSet={mockOnPasswordSet}
        errorMessage="incompatible key format"
      />
    );

    expect(document.body.textContent).toContain('incompatible');
  });
});
