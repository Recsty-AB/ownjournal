import { useTheme } from 'next-themes';

/**
 * Selectable themes, in the order the header button cycles through them.
 * `system` is a valid value for `setTheme()` but is not part of the cycle —
 * it resolves to `light` or `dark`.
 */
export const APP_THEMES = ['light', 'dark', 'paper'] as const;

export type AppTheme = (typeof APP_THEMES)[number];

/**
 * Single source of truth for the active theme.
 *
 * next-themes owns the `<html>` class and the persisted preference; nothing
 * else should touch `documentElement.classList` or write a theme key, or the
 * two will disagree on the next re-render.
 */
export function useAppTheme() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  // useTheme() returns undefined until ThemeProvider mounts (and in tests that
  // render a component in isolation), so fall back to the default palette.
  const activeTheme: AppTheme = (APP_THEMES as readonly string[]).includes(resolvedTheme ?? '')
    ? (resolvedTheme as AppTheme)
    : 'light';

  const nextTheme = APP_THEMES[(APP_THEMES.indexOf(activeTheme) + 1) % APP_THEMES.length];

  return {
    /** The stored preference, which may be `system`. */
    theme: theme ?? 'system',
    /** The palette actually applied right now — never `system`. */
    activeTheme,
    /** What `cycleTheme()` would switch to; useful for button labels. */
    nextTheme,
    isDarkMode: activeTheme === 'dark',
    setTheme: setTheme as (theme: AppTheme | 'system') => void,
    cycleTheme: () => setTheme(nextTheme),
  };
}
