import { test, expect, getContext } from './helpers/test-context';

test.describe('Auth flows', () => {
  test('PB admin login redirects to dashboard and shows correct stats', async ({ page }) => {
    const context = getContext(page);
    await context.loginAsAdmin();
    await context.waitForDashboard();

    // Stat cards use a class that swaps background between light and dark mode.
    const statCards = page.locator('div.bg-white.rounded-lg.p-4, div.dark\\:bg-gray-800.rounded-lg.p-4');
    await expect(statCards).toHaveCount(5);

    const dashboardText = await page.locator('body').textContent();
    expect(dashboardText).toContain('Tenants');
    expect(dashboardText).toContain('Categories');
    expect(dashboardText).toContain('Products');
    expect(dashboardText).toContain('Media');
    expect(dashboardText).toContain('Users');

    await expect(page).toHaveScreenshot('dashboard.png', { fullPage: true });
  });

  test('PB admin: no tenant selector in header', async ({ page }) => {
    const context = getContext(page);
    await context.loginAsAdmin();
    await context.waitForDashboard();

    const header = page.locator('header');
    await expect(header.locator('text=STJÓRNA')).toBeVisible();
    const tenantSelectors = header.locator('select').or(header.locator('[data-testid="tenant-selector"]'));
    await expect(tenantSelectors).toHaveCount(0);
  });

  test('regular user login redirects to dashboard with tenant filter', async ({ page }) => {
    const context = getContext(page);
    await context.loginAsUser();
    await context.waitForDashboard();

    await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
    const header = page.locator('header');
    await expect(header.locator('text=STJÓRNA')).toBeVisible();
  });

  test('PB admin cannot login via user login path', async ({ page }) => {
    const context = getContext(page);
    await page.goto(context.frontendUrl + '/login');

    await page.getByLabel('Email').fill(context.credentials.adminEmail);
    await page.getByLabel('Password').fill(context.credentials.adminPassword);
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();

    await expect(page.locator('.text-red-700, .dark\\:text-red-400')).toBeVisible({ timeout: 10000 });
  });

  // T-04 acceptance: "a wizard reload after completion redirects to /login".
  // The e2e global setup marks the instance as set up
  // (instance_settings.setup_done = true), which the wizard reads through
  // the unauthenticated GET /api/stjorna/setup-status route on mount. No
  // localStorage flag is involved (T-04.2).
  test('setup page redirects to login when setup-status reports setupDone', async ({ page, request }) => {
    const ctx = getContext(page);

    const status = await request.get(ctx.pbUrl + '/api/stjorna/setup-status');
    expect(status.status()).toBe(200);
    const body = await status.json();
    expect(body.setupDone).toBe(true);
    expect(body.superuserExists).toBe(true);

    await page.goto(ctx.frontendUrl + '/setup');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    // The wizard must not have rendered its first step before redirecting.
    await expect(page.getByText('Create superuser & continue')).toHaveCount(0);
  });
});
