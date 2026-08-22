import { test, expect, getContext } from './helpers/test-context';

test.describe('ActiveBadge (yes/no icon component)', () => {
  test('list cell renders Check icon when active (light)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(ctx.frontendUrl + '/categories');
    await page.waitForSelector('table');

    // The Active column buttons have aria-label "Active: Yes/No"
    const activeBtn = page.locator('button[aria-label="Active: Yes"]').first();
    await expect(activeBtn).toBeVisible();
    // svg icon present (lucide Check / X)
    await expect(activeBtn.locator('svg').first()).toBeVisible();
    // bg should be green-600 in light mode for active
    const info = await activeBtn.evaluate(el => ({
      bg: getComputedStyle(el).backgroundColor,
      color: getComputedStyle(el).color,
      text: el.textContent,
    }));
    expect(info.bg).toBe('rgb(22, 163, 74)'); // green-600
    expect(info.color).toBe('rgb(255, 255, 255)'); // white
    expect(info.text?.trim()).toBe('Yes');
  });

  test('list cell renders X icon when inactive (light)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(ctx.frontendUrl + '/categories');
    await page.waitForSelector('table');

    // No inactive categories in seed data; toggle one to inactive first.
    const firstActive = page.locator('button[aria-label="Active: Yes"]').first();
    await expect(firstActive).toBeVisible();
    await firstActive.click();
    await page.waitForTimeout(500);

    // Now there must be at least one inactive.
    const inactiveBtn = page.locator('button[aria-label="Active: No"]').first();
    await expect(inactiveBtn).toBeVisible();
    await expect(inactiveBtn.locator('svg').first()).toBeVisible();
    const info = await inactiveBtn.evaluate(el => ({
      text: el.textContent,
    }));
    expect(info.text?.trim()).toBe('No');
  });

  test('edit form btn is the same component (size=md) and toggles state', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(ctx.frontendUrl + '/categories/new');
    await page.waitForSelector('h1:has-text("New Category")');

    const activeBtn = page.locator('label:has-text("Active") + button, label:has-text("Active") ~ button').first();
    if ((await activeBtn.count()) === 0) {
      // fallback — locate by aria-label
      await page.locator('button[aria-label^="Active:"]').first();
    }
    const btn = page.locator('button[aria-label^="Active:"]').first();
    await expect(btn).toBeVisible();
    await expect(btn.locator('svg').first()).toBeVisible();

    const initial = await btn.getAttribute('aria-label');
    await btn.click();
    await page.waitForTimeout(300);
    const after = await btn.getAttribute('aria-label');
    expect(initial).not.toBe(after);
    // The icon should still be rendered after the toggle.
    await expect(btn.locator('svg').first()).toBeVisible();
  });

  test('dark mode: edit-form toggle renders green-600 + white text + icon', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.emulateMedia({ colorScheme: 'dark' });
    // Fresh edit form has a default-active=true ActiveBadge.
    await page.goto(ctx.frontendUrl + '/categories/new');
    await page.waitForSelector('h1:has-text("New Category")');

    const btn = page.locator('button[aria-label="Active: Yes"]').first();
    await expect(btn).toBeVisible();
    await expect(btn.locator('svg').first()).toBeVisible();
    const info = await btn.evaluate(el => ({
      bg: getComputedStyle(el).backgroundColor,
      color: getComputedStyle(el).color,
    }));
    expect(info.bg).toBe('rgb(22, 163, 74)');     // green-600
    expect(info.color).toBe('rgb(255, 255, 255)'); // white
  });
});

test.describe('ApiDocs wrapper theme', () => {
  test('light mode: swagger wrapper bg is white (not inverted gray-900)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(ctx.frontendUrl + '/api-docs');
    await page.waitForTimeout(1500);
    const bg = await page.locator('[data-testid="swagger-ui"]').evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(255, 255, 255)');
  });

  test('dark mode: swagger wrapper bg is dark (not inverted white)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(ctx.frontendUrl + '/api-docs');
    await page.waitForTimeout(1500);
    const bg = await page.locator('[data-testid="swagger-ui"]').evaluate(el => getComputedStyle(el).backgroundColor);
    // gray-900 = rgb(17, 24, 39)
    expect(bg).toBe('rgb(17, 24, 39)');
  });
});
