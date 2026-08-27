import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { APP_THEMES } from '@/hooks/useAppTheme';

/**
 * index.html applies the theme class before the first paint, because
 * next-themes cannot run until React has mounted — a second or more into a
 * phone launch, which on a dark device meant a full-screen light flash.
 *
 * That makes the inline script a second implementation of the same decision,
 * so it has to keep agreeing with next-themes: same "theme" storage key, same
 * class names, same resolution of "system".
 */
const bootstrapScript = (): string => {
  const html = readFileSync(resolve(__dirname, '../../index.html'), 'utf8');
  const script = html
    .match(/<script>([\s\S]*?)<\/script>/g)
    ?.find((block) => block.includes('prefers-color-scheme'));
  expect(script, 'no pre-paint theme script in index.html').toBeDefined();
  return script!.replace(/<\/?script>/g, '');
};

const runBootstrap = (stored: string | null, systemPrefersDark: boolean) => {
  document.documentElement.className = '';
  document.documentElement.style.colorScheme = '';
  localStorage.clear();
  if (stored) localStorage.setItem('theme', stored);
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('dark') && systemPrefersDark,
    media: query,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));

  new Function(bootstrapScript())();
  return document.documentElement.className;
};

describe('pre-paint theme bootstrap', () => {
  beforeEach(() => {
    document.documentElement.className = '';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('follows the system when nothing is stored', () => {
    expect(runBootstrap(null, true)).toBe('dark');
    expect(runBootstrap(null, false)).toBe('light');
  });

  it('follows the system when the stored preference is "system"', () => {
    expect(runBootstrap('system', true)).toBe('dark');
    expect(runBootstrap('system', false)).toBe('light');
  });

  it('honours an explicit choice over the system setting', () => {
    expect(runBootstrap('light', true)).toBe('light');
    expect(runBootstrap('dark', false)).toBe('dark');
    expect(runBootstrap('paper', true)).toBe('paper');
  });

  it('knows every app theme', () => {
    for (const theme of APP_THEMES) {
      expect(runBootstrap(theme, false)).toBe(theme);
    }
  });

  it('falls back to the system palette for an unrecognised stored value', () => {
    expect(runBootstrap('sepia', true)).toBe('dark');
    expect(runBootstrap('sepia', false)).toBe('light');
  });

  it('sets colorScheme for light and dark, but not for paper', () => {
    runBootstrap('dark', false);
    expect(document.documentElement.style.colorScheme).toBe('dark');

    runBootstrap('paper', false);
    expect(document.documentElement.style.colorScheme).toBe('');
  });
});
