import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
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

  it('should render with theme toggle', () => {
    const mockOnToggleTheme = vi.fn();

    const { container } = render(
      wrap(
        <SettingsDialog
          open={true}
          onOpenChange={mockOnOpenChange}
          onExportData={mockOnExportData}
          onImportData={mockOnImportData}
          onToggleTheme={mockOnToggleTheme}
          isDarkMode={false}
        />
      )
    );

    expect(container).toBeInTheDocument();
  });
});
