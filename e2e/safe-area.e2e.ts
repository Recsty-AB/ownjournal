import { expect, test, type Page } from '@playwright/test';

test.setTimeout(60_000);

async function setInsets(page: Page, top: number, right: number, bottom: number, left: number) {
  // These are the values supplied by Capacitor SystemBars. Real browser layout
  // catches overlaps that jsdom cannot, including changes on keyboard/rotation.
  await page.evaluate((insets) => {
    for (const [edge, value] of Object.entries(insets)) {
      document.documentElement.style.setProperty(`--safe-area-inset-${edge}`, `${value}px`);
    }
  }, { top, right, bottom, left });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 });
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await page.addInitScript(() => localStorage.setItem('i18nextLng', 'en'));
  await page.goto('/demo?clean=true', { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('New Entry', { exact: true })).toBeVisible({ timeout: 15_000 });
});

test('keeps the header and entry button outside system bars as insets change', async ({ page }) => {
  const headerContent = page.locator('header > div').first();
  const newEntry = page.getByLabel('New Entry', { exact: true });

  await setInsets(page, 48, 0, 24, 0);
  await expect.poll(async () => (await headerContent.boundingBox())!.y).toBe(48);
  await expect.poll(async () => {
    const box = (await newEntry.boundingBox())!;
    return 852 - box.y - box.height;
  }).toBe(48);

  // Native padding on old WebViews, and a visible keyboard, can report zero.
  await setInsets(page, 0, 0, 0, 0);
  await expect.poll(async () => (await headerContent.boundingBox())!.y).toBe(0);
  await expect.poll(async () => {
    const box = (await newEntry.boundingBox())!;
    return 852 - box.y - box.height;
  }).toBe(24);

  await page.setViewportSize({ width: 852, height: 393 });
  await setInsets(page, 0, 44, 24, 0);
  const box = (await newEntry.boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(852 - 44 - 24);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(852);
});

test('keeps a confirmation dialog inside an asymmetric safe area', async ({ page }) => {
  await setInsets(page, 80, 0, 24, 0);
  await page.locator('button:has(svg.lucide-trash2)').first().click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect.poll(async () => {
    const box = (await dialog.boundingBox())!;
    return Math.round(box.y + box.height / 2);
  }).toBe(454); // midpoint of the usable vertical area: (80 + 852 - 24) / 2
  const box = (await dialog.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(80);
  expect(box.y + box.height).toBeLessThanOrEqual(852 - 24);
});

test('keeps drawer actions above the navigation area', async ({ page }) => {
  await setInsets(page, 48, 0, 48, 0);
  await page.getByLabel('New Entry', { exact: true }).click();
  await page.getByRole('button', { name: /^Activities/ }).click();
  const drawer = page.getByRole('dialog');
  const done = drawer.getByRole('button', { name: 'Done', exact: true });
  await expect(done).toBeVisible();
  await expect.poll(async () => {
    const box = (await done.boundingBox())!;
    return box.y + box.height;
  }).toBeLessThanOrEqual(852 - 48);
});
