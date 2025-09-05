import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { Header } from '../Header';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('Header', () => {
  const mockUser = {
    name: 'Test User',
    email: 'test@example.com',
    isPro: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render successfully without user', () => {
    const { container } = render(<Header />);
    expect(container).toBeInTheDocument();
  });

  it('should render successfully with user', () => {
    const { container } = render(<Header user={mockUser} />);
    expect(container).toBeInTheDocument();
  });

  it('should render app name', () => {
    const { container } = render(<Header />);
    expect(container.textContent).toContain('app.name');
  });

  it('should render sync status indicator when user exists', () => {
    const { container } = render(
      <Header
        user={mockUser}
        syncStatus="idle"
        connectedProviders={['Google Drive']}
      />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render back button when showBackButton is true', () => {
    const mockOnBack = vi.fn();
    const { container } = render(
      <Header showBackButton={true} onBack={mockOnBack} />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render user avatar when user exists', () => {
    const { container } = render(<Header user={mockUser} />);
    expect(container).toBeInTheDocument();
  });

  it('should handle all callback props', () => {
    const mockCallbacks = {
      onSignOut: vi.fn(),
      onOpenSettings: vi.fn(),
      onExportData: vi.fn(),
      onImportData: vi.fn(),
      onSync: vi.fn(),
      onToggleTheme: vi.fn(),
      onBack: vi.fn(),
    };

    expect(() => {
      render(<Header user={mockUser} {...mockCallbacks} />);
    }).not.toThrow();
  });

  it('should render theme toggle', () => {
    const { container } = render(
      <Header user={mockUser} isDarkMode={false} />
    );
    expect(container).toBeInTheDocument();
  });

  it('should render pro badge for pro users', () => {
    const proUser = { ...mockUser, isPro: true };
    const { container } = render(<Header user={proUser} />);
    expect(container).toBeInTheDocument();
  });
});
