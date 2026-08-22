import { test, expect, getContext } from './helpers/test-context';

const GRAY_700 = 'rgb(55, 65, 81)';
const WHITE = 'rgb(255, 255, 255)';
const BLUE_700 = 'rgb(29, 78, 216)';

test.describe('Color contrast (light mode)', () => {
  test.use({ colorScheme: 'light' });

  test('Profile: inactive theme button (Light mode) uses gray-900 for stronger contrast on white bg', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.goto(ctx.frontendUrl + '/profile');
    await page.waitForSelector('[data-testid="theme-light"]');
    await page.locator('[data-testid="theme-light"]').click();
    await page.waitForTimeout(300);

    const darkColor = await page.locator('[data-testid="theme-dark"]').evaluate(el => getComputedStyle(el).color);
    expect(darkColor).toBe('rgb(17, 24, 39)');

    const systemColor = await page.locator('[data-testid="theme-system"]').evaluate(el => getComputedStyle(el).color);
    expect(systemColor).toBe('rgb(17, 24, 39)');

    const captionColor = await page.locator('[data-testid="theme-effective"]').evaluate(el => getComputedStyle(el.parentElement!).color);
    expect(captionColor).toBe('rgb(75, 85, 99)');
  });

  test('Profile: active theme button (Light mode) keeps white text on blue-600', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.goto(ctx.frontendUrl + '/profile');
    await page.waitForSelector('[data-testid="theme-light"]');
    await page.locator('[data-testid="theme-dark"]').click();
    await page.waitForTimeout(300);

    const darkActiveColor = await page.locator('[data-testid="theme-dark"]').evaluate(el => getComputedStyle(el).color);
    expect(darkActiveColor).toBe(WHITE);
  });

  test('Activities: form labels use gray-700 (not gray-500) for readable contrast', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.goto(ctx.frontendUrl + '/activities');
    await page.waitForTimeout(800);

    const labels = await page.locator('label').all();
    expect(labels.length).toBeGreaterThan(0);
    for (const label of labels) {
      const color = await label.evaluate(el => getComputedStyle(el).color);
      expect(color, label.textContent()).toBe(GRAY_700);
    }
  });

  test('Activities: filter chips use white text on colored entity background (light mode)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.goto(ctx.frontendUrl + '/activities');
    await page.waitForTimeout(800);

    await page.locator('button').filter({ hasText: /^Media$/ }).first().click();
    await page.waitForTimeout(300);

    // The active chip - find one with bg-blue-600 inside the type filter chips div
    const activeChip = page.locator('div.flex.flex-wrap.gap-1\\.5 button.bg-blue-600').first();
    await expect(activeChip).toBeVisible();
    const color = await activeChip.evaluate(el => getComputedStyle(el).color);
    expect(color).toBe(WHITE);
  });

  test('Activities: action chips use white text on blue background (light mode)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.goto(ctx.frontendUrl + '/activities');
    await page.waitForTimeout(800);

    await page.locator('button').filter({ hasText: /^created$/ }).first().click();
    await page.waitForTimeout(300);

    // first bg-blue-600 button (the active created chip)
    const activeChip = page.locator('button.bg-blue-600').first();
    await expect(activeChip).toHaveText(/created/);
    const color = await activeChip.evaluate(el => getComputedStyle(el).color);
    expect(color).toBe(WHITE);
  });

  test('Sidebar: active nav badge has white text on blue-700 (light mode)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.goto(ctx.frontendUrl + '/media');
    await page.waitForTimeout(800);

    // Find the count badge inside the active /media link
    const badge = page.locator('a[href="/media"] span').last();
    await expect(badge).toBeVisible();
    const info = await badge.evaluate(el => ({
      bg: getComputedStyle(el).backgroundColor,
      color: getComputedStyle(el).color,
    }));
    expect(info.bg).toBe(BLUE_700);
    expect(info.color).toBe(WHITE);
  });

  test('+ Add buttons: text is white in light mode (not gray-900)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();

    // Categories page
    await page.goto(ctx.frontendUrl + '/categories');
    await page.waitForTimeout(800);
    let btn = page.locator('a[href="/categories/new"]:has-text("+ Add Category")');
    if ((await btn.count()) > 0) {
      const info = await btn.first().evaluate(el => ({
        bg: getComputedStyle(el).backgroundColor,
        color: getComputedStyle(el).color,
      }));
      expect(info.color, '+ Add Category text').toBe(WHITE);
      expect(info.bg).toBe('rgb(147, 51, 234)'); // purple-600
    }

    // Media page
    await page.goto(ctx.frontendUrl + '/media');
    await page.waitForTimeout(800);
    btn = page.locator('a[href="/media/new"]:has-text("+ Add Media")');
    if ((await btn.count()) > 0) {
      const info = await btn.first().evaluate(el => ({
        bg: getComputedStyle(el).backgroundColor,
        color: getComputedStyle(el).color,
      }));
      expect(info.color, '+ Add Media text').toBe(WHITE);
      expect(info.bg).toBe('rgb(37, 99, 235)'); // blue-600
    }

    // Dashboard (Quick Actions) — test all entity colors
    await page.goto(ctx.frontendUrl + '/');
    await page.waitForTimeout(800);
    const dashChecks: Array<[string, string]> = [
      ['+ Add Category', 'rgb(147, 51, 234)'],  // purple-600
      ['+ Add Media', 'rgb(37, 99, 235)'],     // blue-600
      ['+ Add Product', 'rgb(5, 150, 105)'],   // emerald-600
    ];
    for (const [label, expectedBg] of dashChecks) {
      btn = page.locator(`a:has-text("${label}")`).first();
      const info = await btn.evaluate(el => ({
        bg: getComputedStyle(el).backgroundColor,
        color: getComputedStyle(el).color,
      }));
      expect(info.color, `${label} text`).toBe(WHITE);
      expect(info.bg, `${label} bg`).toBe(expectedBg);
    }
  });

  test('Activities: row Type badges use white text on entity color (light mode)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.goto(ctx.frontendUrl + '/activities');
    await page.waitForTimeout(1500);
    await page.waitForSelector('tbody tr', { timeout: 5000 });

    const badges = await page.locator('tbody tr span').filter({ hasText: /^(Tenant|User|Product|Media|Category)$/ }).all();
    expect(badges.length).toBeGreaterThan(0);
    for (const badge of badges) {
      const info = await badge.evaluate(el => ({
        text: el.textContent,
        bg: getComputedStyle(el).backgroundColor,
        color: getComputedStyle(el).color,
      }));
      // Light mode entity color backgrounds are saturated (orange, cyan,
      // emerald, blue, purple) → white text. Skip gray-100 fallback case.
      if (!info.bg.startsWith('rgb(243, 244, 246)') && !info.bg.startsWith('rgb(243')) {
        expect(info.color, `${info.text} row badge text`).toBe(WHITE);
      }
    }
  });

  test('Activities: row Action badges use dark text-700 on pale solid bg (light mode)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.goto(ctx.frontendUrl + '/activities');
    await page.waitForTimeout(1500);
    await page.waitForSelector('tbody tr', { timeout: 5000 });

    // 'created' on a green-100 bg should be green-700 text (dark enough to read on pale green)
    const expected: Array<[RegExp, string, string]> = [
      [/^created$/, 'rgb(220, 252, 231)', 'rgb(21, 128, 61)'],   // bg-green-100, text-green-700
      [/^updated$/, 'rgb(219, 234, 254)', 'rgb(29, 78, 216)'],   // bg-blue-100, text-blue-700
      [/^deleted$/, 'rgb(254, 226, 226)', 'rgb(185, 28, 28)'],   // bg-red-100, text-red-700
    ];

    for (const [textRe, expectedBg, expectedColor] of expected) {
      const badge = page.locator('tbody tr span').filter({ hasText: textRe }).first();
      if ((await badge.count()) > 0) {
        const info = await badge.evaluate(el => ({
          bg: getComputedStyle(el).backgroundColor,
          color: getComputedStyle(el).color,
        }));
        expect(info.bg, `${textRe.source} bg`).toBe(expectedBg);
        expect(info.color, `${textRe.source} text`).toBe(expectedColor);
      }
    }
  });

  test('Sidebar: inactive nav badges keep low-contrast gray (not changed)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.goto(ctx.frontendUrl + '/media');
    await page.waitForTimeout(800);

    // Categories badge on the /media page is inactive
    const badge = page.locator('a[href="/categories"] span').last();
    await expect(badge).toBeVisible();
    const color = await badge.evaluate(el => getComputedStyle(el).color);
    // gray-500 light = rgb(107, 114, 128)
    expect(color).toBe('rgb(107, 114, 128)');
  });
});

test.describe('Color contrast (dark mode)', () => {
  test.use({ colorScheme: 'dark' });

  test('Profile: inactive theme button (Dark mode) keeps gray-300', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.goto(ctx.frontendUrl + '/profile');
    await page.waitForSelector('[data-testid="theme-light"]');
    await page.locator('[data-testid="theme-dark"]').click();
    await page.waitForTimeout(300);

    const lightInactive = await page.locator('[data-testid="theme-light"]').evaluate(el => getComputedStyle(el).color);
    expect(lightInactive).toBe('rgb(209, 213, 219)');
  });

  test('Sidebar: active nav badge has white text on blue-700 (dark mode)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.goto(ctx.frontendUrl + '/media');
    await page.waitForTimeout(800);

    const badge = page.locator('a[href="/media"] span').last();
    await expect(badge).toBeVisible();
    const info = await badge.evaluate(el => ({
      bg: getComputedStyle(el).backgroundColor,
      color: getComputedStyle(el).color,
    }));
    expect(info.bg).toBe(BLUE_700);
    expect(info.color).toBe(WHITE);
  });

  test('+ Add buttons: text is white in dark mode too', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();

    await page.goto(ctx.frontendUrl + '/categories');
    await page.waitForTimeout(800);
    const btn = page.locator('a[href="/categories/new"]:has-text("+ Add Category")').first();
    if ((await btn.count()) > 0) {
      const color = await btn.evaluate(el => getComputedStyle(el).color);
      expect(color).toBe(WHITE);
    }
  });

  test('Activities: row Action badges keep light text-300 in dark mode', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.goto(ctx.frontendUrl + '/activities');
    await page.waitForTimeout(1500);
    await page.waitForSelector('tbody tr', { timeout: 5000 });

    const checks: Array<[RegExp, string]> = [
      [/^created$/, 'rgb(134, 239, 172)'],   // green-300
      [/^updated$/, 'rgb(147, 197, 253)'],   // blue-300
      [/^deleted$/, 'rgb(252, 165, 165)'],   // red-300
    ];
    for (const [re, expectedColor] of checks) {
      const badge = page.locator('tbody tr span').filter({ hasText: re }).first();
      if ((await badge.count()) > 0) {
        const color = await badge.evaluate(el => getComputedStyle(el).color);
        expect(color, re.source).toBe(expectedColor);
      }
    }
  });

  test('Activities: entity chip active uses white text on entity color (dark mode)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.goto(ctx.frontendUrl + '/activities');
    await page.waitForTimeout(800);

    await page.locator('button').filter({ hasText: /^Media$/ }).first().click();
    await page.waitForTimeout(300);

    const activeChip = page.locator('div.flex.flex-wrap.gap-1\\.5 button.bg-blue-600').first();
    await expect(activeChip).toBeVisible();
    const color = await activeChip.evaluate(el => getComputedStyle(el).color);
    expect(color).toBe(WHITE);
  });
});
