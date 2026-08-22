import { test, expect, getContext } from './helpers/test-context';

test.describe('Profile page', () => {
  let ctx: ReturnType<typeof getContext>;

  test.beforeEach(async ({ page }) => {
    ctx = getContext(page);
    await ctx.loginAsUser();
    await ctx.waitForDashboard();
  });

  test('profile page loads with all three sections', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/profile');
    await expect(page.locator('h1:has-text("Profile")')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Account/i).first()).toBeVisible();
    await expect(page.getByText(/Change password/i).first()).toBeVisible();
    await expect(page.getByText(/Appearance/i).first()).toBeVisible();
    await expect(page.locator('[data-testid="theme-light"]')).toBeVisible();
    await expect(page.locator('[data-testid="theme-dark"]')).toBeVisible();
    await expect(page.locator('[data-testid="theme-system"]')).toBeVisible();
  });

  test('user menu has a Profile entry that navigates to /profile', async ({ page }) => {
    // The dropdown is in the DOM, just hidden until hover/focus. Check it's present.
    const profileBtn = page.locator('[data-testid="user-menu-profile"]');
    await expect(profileBtn).toHaveCount(1);
    await expect(profileBtn).toContainText('Profile');

    // Force the click — the dropdown is hidden until group-hover but the
    // button is in the DOM. dispatchEvent bypasses the visibility check
    // that block normal clicks.
    await profileBtn.evaluate((el) => (el as HTMLButtonElement).click());

    await page.waitForURL(/\/profile$/, { timeout: 10000 });
    await expect(page.locator('h1:has-text("Profile")')).toBeVisible();
  });

  test('rejects empty password fields', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/profile');
    await page.waitForSelector('#pw-current');
    await page.locator('button:has-text("Update password")').click();
    await expect(page.getByText(/All password fields are required/i)).toBeVisible();
  });

  test('rejects mismatched confirm', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/profile');
    await page.waitForSelector('#pw-current');
    await page.locator('#pw-current').fill(ctx.credentials.userPassword);
    await page.locator('#pw-new').fill('NewPass1234!');
    await page.locator('#pw-confirm').fill('DifferentPass1234!');
    await page.locator('button:has-text("Update password")').click();
    await expect(page.getByText(/do not match/i)).toBeVisible();
  });

  test('rejects password too short', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/profile');
    await page.waitForSelector('#pw-current');
    await page.locator('#pw-current').fill(ctx.credentials.userPassword);
    await page.locator('#pw-new').fill('Short1!');
    await page.locator('#pw-confirm').fill('Short1!');
    await page.locator('button:has-text("Update password")').click();
    await expect(page.getByText(/at least 8/)).toBeVisible();
  });

  test('theme toggle: Light removes dark class; Dark restores it; persists on reload', async ({ page }) => {
    // Navigate to profile where the toggle lives
    await page.goto(ctx.frontendUrl + '/profile');
    await page.waitForSelector('[data-testid="theme-light"]');

    const hasDark = () =>
      page.evaluate(() => document.documentElement.classList.contains('dark'));

    // Force a known starting state — set to Dark first.
    await page.locator('[data-testid="theme-dark"]').click();
    await page.waitForFunction(
      () => document.documentElement.classList.contains('dark'),
      null,
      { timeout: 5000 }
    );
    expect(await hasDark()).toBe(true);

    // Switch to Light → dark class must be absent.
    await page.locator('[data-testid="theme-light"]').click();
    await page.waitForFunction(
      () => !document.documentElement.classList.contains('dark'),
      null,
      { timeout: 5000 }
    );
    expect(await hasDark()).toBe(false);

    // Persistence: reload, light choice survives.
    await page.reload();
    expect(await hasDark()).toBe(false);

    // Verify the localStorage value is set.
    const stored = await page.evaluate(() => window.localStorage.getItem('stjorna_theme_mode'));
    expect(stored).toBe('light');

    // Restore default for subsequent tests.
    await page.locator('[data-testid="theme-system"]').click();
  });
});