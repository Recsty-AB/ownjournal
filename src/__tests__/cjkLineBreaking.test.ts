import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Regression guard for Japanese/Chinese line wrapping.
 *
 * `word-break: keep-all` treats an unspaced CJK run as one unbreakable word,
 * so the only remaining break opportunities are the emergency ones from
 * `overflow-wrap: anywhere`. Those ignore kinsoku, which put a lone 。 at the
 * start of a line in the entry editor on Android. Only Korean, which spaces
 * its words, should ever get keep-all.
 */
describe('CJK line breaking rules in index.css', () => {
  const css = readFileSync(resolve(__dirname, '../index.css'), 'utf-8');

  const rulesWith = (declaration: RegExp) =>
    Array.from(css.matchAll(/([^{}]+)\{([^{}]*)\}/g))
      .filter(([, , body]) => declaration.test(body))
      .map(([, selector]) => selector.trim());

  it('does not apply word-break: keep-all to Japanese or Chinese', () => {
    const keepAllSelectors = rulesWith(/word-break\s*:\s*keep-all/);
    expect(keepAllSelectors.length).toBeGreaterThan(0);
    for (const selector of keepAllSelectors) {
      expect(selector).not.toMatch(/:lang\(ja\)/);
      expect(selector).not.toMatch(/:lang\(zh/);
    }
  });

  it('keeps keep-all for Korean, which breaks at word spaces', () => {
    const keepAllSelectors = rulesWith(/word-break\s*:\s*keep-all/);
    expect(keepAllSelectors.some((s) => /:lang\(ko\)/.test(s))).toBe(true);
  });

  it('leaves Japanese with normal word-break and an overflow fallback', () => {
    const jaSelectors = rulesWith(/word-break\s*:\s*normal/).filter((s) => /:lang\(ja\)/.test(s));
    expect(jaSelectors).toHaveLength(1);
    const anywhereSelectors = rulesWith(/overflow-wrap\s*:\s*anywhere/);
    expect(anywhereSelectors.some((s) => /:lang\(ja\)/.test(s))).toBe(true);
    const strictSelectors = rulesWith(/line-break\s*:\s*strict/);
    expect(strictSelectors.some((s) => /:lang\(ja\)/.test(s))).toBe(true);
  });
});
