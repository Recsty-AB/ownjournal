import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useAppTheme, type AppTheme } from './useAppTheme';

/**
 * Colour of the OS chrome around the page, per theme. These mirror the
 * `--background` token for each theme in src/index.css so the native bars and
 * the browser UI blend into the page rather than framing it.
 */
const CHROME_COLORS: Record<AppTheme, string> = {
  light: '#f8f6f3',
  dark: '#1a140f',
  paper: '#ffffff',
};

/**
 * Keeps the browser's `theme-color` and the Android system bars in sync with
 * the active theme.
 *
 * On Android, EdgeToEdge.setStatusBarColor()/setNavigationBarColor() paint plain
 * overlay views sized to the window insets. They do not call
 * Window.setStatusBarColor(), which Android 15 deprecated and ignores — as do
 * the deprecated EdgeToEdge.setBackgroundColor() and `backgroundColor` config
 * option, which is why neither is used here.
 */
export function useSystemChrome() {
  const { activeTheme, isDarkMode } = useAppTheme();
  const color = CHROME_COLORS[activeTheme];

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  }, [color]);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    let cancelled = false;

    void (async () => {
      try {
        const { EdgeToEdge } = await import('@capawesome/capacitor-android-edge-to-edge-support');
        const { StatusBar, Style } = await import('@capacitor/status-bar');
        if (cancelled) return;

        await EdgeToEdge.setStatusBarColor({ color });
        await EdgeToEdge.setNavigationBarColor({ color });
        // Style.Dark means "light icons for a dark background" and Style.Light
        // means "dark icons for a light background" — the name describes the
        // background, not the icons.
        await StatusBar.setStyle({ style: isDarkMode ? Style.Dark : Style.Light });
      } catch (err) {
        if (import.meta.env.DEV) console.error('System chrome theming failed:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [color, isDarkMode]);
}
