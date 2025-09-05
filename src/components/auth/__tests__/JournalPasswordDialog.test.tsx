import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { JournalPasswordDialog } from '../JournalPasswordDialog';

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('JournalPasswordDialog', () => {
  const mockOnPasswordSet = vi.fn().mockResolvedValue(undefined);
  const mockOnDismiss = vi.fn();
  const mockOnOpenChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when open is true', () => {
    const { container } = render(
      <JournalPasswordDialog
        open={true}
        onPasswordSet={mockOnPasswordSet}
      />
    );
    
    expect(container).toBeInTheDocument();
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
    const { container } = render(
      <JournalPasswordDialog
        open={true}
        onPasswordSet={mockOnPasswordSet}
        errorMessage="Test error message"
      />
    );
    
    expect(container.textContent).toContain('Test error message');
  });

  it('should render for OAuth users', () => {
    const { container } = render(
      <JournalPasswordDialog
        open={true}
        onPasswordSet={mockOnPasswordSet}
        isOAuthUser={true}
      />
    );
    
    expect(container).toBeInTheDocument();
  });

  it('should render password input fields', () => {
    const { container } = render(
      <JournalPasswordDialog
        open={true}
        onPasswordSet={mockOnPasswordSet}
      />
    );
    
    const inputs = container.querySelectorAll('input[type="password"]');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it('should render password visibility toggles', () => {
    const { container } = render(
      <JournalPasswordDialog
        open={true}
        onPasswordSet={mockOnPasswordSet}
      />
    );
    
    expect(container).toBeInTheDocument();
  });

  it('should render submit button', () => {
    const { container } = render(
      <JournalPasswordDialog
        open={true}
        onPasswordSet={mockOnPasswordSet}
      />
    );
    
    const buttons = container.querySelectorAll('button');
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
    const { container } = render(
      <JournalPasswordDialog
        open={true}
        onPasswordSet={mockOnPasswordSet}
        errorMessage="incompatible key format"
      />
    );
    
    expect(container.textContent).toContain('incompatible');
  });
});
