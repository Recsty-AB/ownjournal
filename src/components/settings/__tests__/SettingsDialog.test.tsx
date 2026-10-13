import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SettingsDialog } from '../SettingsDialog';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: vi.fn(),
      language: 'en',
    },
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

let mockPlatform = 'web';
vi.mock('@/utils/platformDetection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/platformDetection')>();
  return {
    ...actual,
    getPlatformInfo: () => ({ ...actual.getPlatformInfo(), platform: mockPlatform }),
  };
});

const wrap = (ui: React.ReactElement) => <MemoryRouter>{ui}</MemoryRouter>;

describe('SettingsDialog', () => {
  const mockOnOpenChange = vi.fn();
  const mockOnExportData = vi.fn();
  const mockOnImportData = vi.fn();

  it('should default to storage tab', () => {
    const { container } = render(
      wrap(
        <SettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onExportData={mockOnExportData}
          onImportData={mockOnImportData}
        />
      )
    );

    expect(container).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    const { container } = render(
      wrap(
        <SettingsDialog
          open={false}
          onOpenChange={mockOnOpenChange}
          onExportData={mockOnExportData}
          onImportData={mockOnImportData}
        />
      )
    );

    expect(container).toBeInTheDocument();
  });

  it('should render the appearance controls', () => {
    const { container } = render(
      wrap(
        <SettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onExportData={mockOnExportData}
          onImportData={mockOnImportData}
        />
      )
    );

    expect(container).toBeInTheDocument();
  });

  const renderPreferences = () =>
    render(
      wrap(
        <SettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onExportData={mockOnExportData}
          onImportData={mockOnImportData}
          defaultTab="preferences"
        />
      )
    );

  it('shows the Google Play rating link on Android', () => {
    mockPlatform = 'capacitor-android';
    renderPreferences();
    const link = screen.getByRole('link', { name: 'settings.feedback.rateOnGooglePlay' });
    expect(link).toHaveAttribute('href', expect.stringContaining('play.google.com'));
  });

  it.each(['web', 'capacitor-ios', 'electron-mac'])('hides the rating link on %s', (platform) => {
    mockPlatform = platform;
    renderPreferences();
    expect(screen.queryByText('settings.feedback.rateOnGooglePlay')).not.toBeInTheDocument();
  });
});
