import { test, expect, Page } from '@playwright/test';

// Verifies the storage-persistence fix in a real browser engine (Chromium and
// WebKit) against the auth-free /demo route. See STORAGE_PERSISTENCE_TEST_PLAN.md
// section 2. These keys hold the preferences WebKit evicts on the reported bug.
const PREF_KEY_RE = /journalEncryptionMode|preferred_primary_provider/;

function collectErrors(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const consoleLogs: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    consoleLogs.push(`${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (err) => pageErrors.push(String(err)));
  return { consoleErrors, pageErrors, consoleLogs };
}

test.describe('storage persistence fix', () => {
  test('app boots at /demo with no console errors', async ({ page }) => {
    const { consoleErrors, pageErrors } = collectErrors(page);

    await page.goto('/demo', { waitUntil: 'load' });
    // The React app must have rendered into #root.
    await expect(page.locator('#root')).not.toBeEmpty();
    // Allow best-effort async bootstrap (SW skip, persist request, AI cache) to run.
    await page.waitForTimeout(1500);

    expect(pageErrors, `uncaught errors:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
  });

  test('requestPersistentStorage runs at startup and persisted() returns a boolean', async ({ page }) => {
    const { consoleLogs, pageErrors } = collectErrors(page);

    await page.goto('/demo', { waitUntil: 'load' });
    await expect(page.locator('#root')).not.toBeEmpty();
    await page.waitForTimeout(1500);

    // main.tsx logs "[storage] persistent = <bool>" in DEV once
    // requestPersistentStorage() resolves, proving the fix was invoked at
    // startup and resolved to a boolean (true|false) without throwing — even in
    // WebKit, where the StorageManager persist API is absent and the function's
    // unsupported-guard returns false.
    const persistLog = consoleLogs.find((l) => l.includes('[storage] persistent ='));
    expect(persistLog, `consoleLogs:\n${consoleLogs.join('\n')}`).toBeTruthy();
    expect(persistLog).toMatch(/\[storage\] persistent = (true|false)$/);

    // Where the StorageManager persist API exists (Chromium), persisted() must
    // resolve to a boolean. Playwright's WebKit does not implement it at all
    // (navigator.storage.persisted === undefined), which is the unsupported case
    // the fix handles by returning false — so we don't call it there.
    const apiState = await page.evaluate(async () => {
      if (!navigator.storage?.persist || !navigator.storage?.persisted) return 'unsupported';
      try {
        const v = await navigator.storage.persisted();
        return typeof v === 'boolean' ? 'boolean' : 'non-boolean:' + typeof v;
      } catch (e) {
        return 'threw:' + String(e);
      }
    });
    expect(['boolean', 'unsupported']).toContain(apiState);

    // The fix's own logic (mirrored here) must never throw in either engine.
    const result = await page.evaluate(async () => {
      try {
        if (!navigator.storage?.persist || !navigator.storage?.persisted) return 'unsupported';
        if (await navigator.storage.persisted()) return 'already';
        await navigator.storage.persist();
        return 'requested';
      } catch (e) {
        return 'threw:' + String(e);
      }
    });
    expect(result).not.toMatch(/^threw/);
    expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  });

  test('survives simulated eviction of the scoped preference keys', async ({ page }) => {
    await page.goto('/demo', { waitUntil: 'load' });
    await expect(page.locator('#root')).not.toBeEmpty();

    // Seed both the unscoped keys (demo route has no auth) and scoped variants
    // to mimic a signed-in WebKit user's stored preferences.
    await page.evaluate(() => {
      localStorage.setItem('journalEncryptionMode', 'e2e');
      localStorage.setItem('preferred_primary_provider', 'iCloud');
      localStorage.setItem('u:test-user:journalEncryptionMode', 'e2e');
      localStorage.setItem('u:test-user:preferred_primary_provider', 'iCloud');
    });
    await page.reload({ waitUntil: 'load' });
    await expect(page.locator('#root')).not.toBeEmpty();

    // Simulate WebKit ITP / DuckDuckGo eviction: wipe those preference keys.
    const removed = await page.evaluate((reSrc) => {
      const re = new RegExp(reSrc);
      const hit = Object.keys(localStorage).filter((k) => re.test(k));
      hit.forEach((k) => localStorage.removeItem(k));
      return hit;
    }, PREF_KEY_RE.source);
    expect(removed.length).toBeGreaterThan(0);

    // Reload after eviction — the app must not crash and must fall back gracefully.
    const { consoleErrors, pageErrors } = collectErrors(page);
    await page.reload({ waitUntil: 'load' });
    await expect(page.locator('#root')).not.toBeEmpty();
    await page.waitForTimeout(1500);

    expect(pageErrors, `uncaught errors:\n${pageErrors.join('\n')}`).toEqual([]);
    expect(consoleErrors, `console errors:\n${consoleErrors.join('\n')}`).toEqual([]);
    // Still on the demo route, content rendered (graceful fallback to defaults).
    await expect(page).toHaveURL(/\/demo/);
  });
});
