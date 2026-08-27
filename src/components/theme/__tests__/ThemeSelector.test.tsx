import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'next-themes';
import { ThemeSelector } from '../ThemeSelector';
import { APP_THEMES, THEME_PREFERENCES } from '@/hooks/useAppTheme';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn(), language: 'en' },
  }),
}));

const wrap = (ui: React.ReactElement) => (
  <ThemeProvider attribute="class" defaultTheme="light" themes={[...APP_THEMES]}>
    {ui}
  </ThemeProvider>
);

describe('ThemeSelector', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('offers every app theme plus system', () => {
    render(wrap(<ThemeSelector />));

    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(THEME_PREFERENCES.length);
    expect(options.map((o) => o.textContent)).toEqual(
      THEME_PREFERENCES.map((theme) => `theme.${theme}`)
    );
  });

  it('marks the active theme as checked', () => {
    render(wrap(<ThemeSelector />));

    expect(screen.getByRole('radio', { name: 'theme.light' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'theme.paper' })).not.toBeChecked();
  });

  it('checks system rather than the palette it resolves to', async () => {
    const user = userEvent.setup();
    render(wrap(<ThemeSelector />));

    await user.click(screen.getByRole('radio', { name: 'theme.system' }));

    expect(screen.getByRole('radio', { name: 'theme.system' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'theme.light' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'theme.dark' })).not.toBeChecked();
  });

  it('applies the paper class to <html> when paper is selected', async () => {
    const user = userEvent.setup();
    render(wrap(<ThemeSelector />));

    await user.click(screen.getByRole('radio', { name: 'theme.paper' }));

    expect(document.documentElement.classList.contains('paper')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
