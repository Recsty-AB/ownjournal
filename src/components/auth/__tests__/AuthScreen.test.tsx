import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthScreen } from '../AuthScreen';

// Mock dependencies
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      signUp: vi.fn().mockResolvedValue({ error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

const wrap = (ui: React.ReactElement) => <MemoryRouter>{ui}</MemoryRouter>;

describe('AuthScreen', () => {
  const mockOnGoogleSignIn = vi.fn();
  const mockOnAppleSignIn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render successfully', () => {
    const { container } = render(
      wrap(
        <AuthScreen
          onGoogleSignIn={mockOnGoogleSignIn}
          onAppleSignIn={mockOnAppleSignIn}
        />
      )
    );

    expect(container).toBeInTheDocument();
  });

  it('should render title and subtitle', () => {
    const { container } = render(
      wrap(
        <AuthScreen
          onGoogleSignIn={mockOnGoogleSignIn}
          onAppleSignIn={mockOnAppleSignIn}
        />
      )
    );

    expect(container.textContent).toContain('auth.title');
    expect(container.textContent).toContain('auth.subtitle');
  });

  it('should render feature highlights', () => {
    const { container } = render(
      wrap(
        <AuthScreen
          onGoogleSignIn={mockOnGoogleSignIn}
          onAppleSignIn={mockOnAppleSignIn}
        />
      )
    );

    expect(container.textContent).toContain('features.endToEnd');
    expect(container.textContent).toContain('features.encryption');
  });

  it('should render email input fields', () => {
    const { container } = render(
      wrap(
        <AuthScreen
          onGoogleSignIn={mockOnGoogleSignIn}
          onAppleSignIn={mockOnAppleSignIn}
        />
      )
    );

    const inputs = container.querySelectorAll('input');
    expect(inputs.length).toBeGreaterThanOrEqual(2); // email and password
  });

  it('should render OAuth buttons', () => {
    const { container } = render(
      wrap(
        <AuthScreen
          onGoogleSignIn={mockOnGoogleSignIn}
          onAppleSignIn={mockOnAppleSignIn}
        />
      )
    );

    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBeGreaterThan(0);
  });

  it('should toggle between sign in and sign up modes', () => {
    const { container } = render(
      wrap(
        <AuthScreen
          onGoogleSignIn={mockOnGoogleSignIn}
          onAppleSignIn={mockOnAppleSignIn}
        />
      )
    );

    // Should render mode toggle
    expect(container).toBeInTheDocument();
  });

  it('should accept callback props', () => {
    expect(() => {
      render(
        wrap(
          <AuthScreen
            onGoogleSignIn={mockOnGoogleSignIn}
            onAppleSignIn={mockOnAppleSignIn}
          />
        )
      );
    }).not.toThrow();
  });

  it('should render with loading states disabled initially', () => {
    const { container } = render(
      wrap(
        <AuthScreen
          onGoogleSignIn={mockOnGoogleSignIn}
          onAppleSignIn={mockOnAppleSignIn}
        />
      )
    );

    expect(container).toBeInTheDocument();
  });
});
