import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from 'next-themes';
import { ThemeSelector } from '../ThemeSelector';
import { APP_THEMES } from '@/hooks/useAppTheme';

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

  it('offers every app theme, paper included', () => {
    render(wrap(<ThemeSelector />));

    const options = screen.getAllByRole('radio');
    expect(options).toHaveLength(APP_THEMES.length);
    expect(options.map((o) => o.textContent)).toEqual(
      APP_THEMES.map((theme) => `theme.${theme}`)
    );
  });

  it('marks the active theme as checked', () => {
    render(wrap(<ThemeSelector />));

    expect(screen.getByRole('radio', { name: 'theme.light' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'theme.paper' })).not.toBeChecked();
  });

  it('applies the paper class to <html> when paper is selected', async () => {
    const user = userEvent.setup();
    render(wrap(<ThemeSelector />));

    await user.click(screen.getByRole('radio', { name: 'theme.paper' }));

    expect(document.documentElement.classList.contains('paper')).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
