import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The app stacks surfaces by hand-written Tailwind z-index classes, and the
 * order between them is load-bearing: Settings and Help render as opaque
 * full-height drawers on mobile, and they open dialogs (PDF/Word export,
 * delete confirmations) and raise toasts from inside. When a dialog or toast
 * ranked below the drawer it was still mounted and still working — just
 * invisible behind it, so the tap looked like it did nothing and no error was
 * ever shown.
 *
 * This locks the ordering in place; the numbers may move, their order may not.
 */
const read = (file: string) =>
  readFileSync(resolve(__dirname, '..', file), 'utf8');

/** Highest z-index used by a component's own class strings. */
const topLayer = (source: string): number => {
  const matches = [...source.matchAll(/\bz-\[(\d+)\]/g)].map((m) => Number(m[1]));
  const bare = [...source.matchAll(/\bz-(\d+)\b/g)].map((m) => Number(m[1]));
  const all = [...matches, ...bare];
  expect(all.length).toBeGreaterThan(0);
  return Math.max(...all);
};

describe('overlay layering', () => {
  const drawer = topLayer(read('drawer.tsx'));
  const dialog = topLayer(read('dialog.tsx'));
  const alertDialog = topLayer(read('alert-dialog.tsx'));
  const toast = topLayer(read('toast.tsx'));

  it('puts dialogs above the full-height drawer', () => {
    expect(dialog).toBeGreaterThan(drawer);
    expect(alertDialog).toBeGreaterThan(drawer);
  });

  it('puts toasts above everything else', () => {
    expect(toast).toBeGreaterThan(dialog);
    expect(toast).toBeGreaterThan(alertDialog);
    expect(toast).toBeGreaterThan(drawer);
  });
});
