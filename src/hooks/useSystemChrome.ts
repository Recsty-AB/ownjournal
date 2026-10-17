import { useEffect } from 'react';
import { Capacitor, registerPlugin, SystemBars, SystemBarsStyle } from '@capacitor/core';
import { useAppTheme, type AppTheme } from './useAppTheme';

const SystemChrome = registerPlugin<{
  setBackgroundColor(options: { color: string }): Promise<void>;
}>('SystemChrome');

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
 * Android's system bars are transparent: the page supplies their background,
 * and Capacitor's built-in SystemBars API sets icon contrast for both bars.
 * Older WebViews use native padding; SystemChrome paints that view to match.
 */
export function useSystemChrome() {
  const { activeTheme, isDarkMode } = useAppTheme();
  const color = CHROME_COLORS[activeTheme];

  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color);
  }, [color]);

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;

    void (async () => {
      try {
        // Dark/Light describe the background, so Dark requests light icons.
        await SystemBars.setStyle({
          style: isDarkMode ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
        });
        // SystemBars resets the decor background to the OS theme in setStyle().
        // Apply the app palette afterwards for the native-padding fallback.
        await SystemChrome.setBackgroundColor({ color });
      } catch (err) {
        if (import.meta.env.DEV) console.error('System chrome theming failed:', err);
      }
    })();

  }, [color, isDarkMode]);
}
