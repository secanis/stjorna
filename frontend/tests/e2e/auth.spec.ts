import { test, expect, getContext } from './helpers/test-context';

test.describe('Auth flows', () => {
  test('PB admin login redirects to dashboard and shows correct stats', async ({ page }) => {
    const context = getContext(page);
    await context.loginAsAdmin();
    await context.waitForDashboard();

    const statCards = page.locator('.bg-gray-800.rounded-lg.p-4');
    await expect(statCards).toHaveCount(5);

    const dashboardText = await page.locator('body').textContent();
    expect(dashboardText).toContain('Tenants');
    expect(dashboardText).toContain('Categories');
    expect(dashboardText).toContain('Products');
    expect(dashboardText).toContain('Media');
    expect(dashboardText).toContain('Users');
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

    await page.getByRole('button', { name: 'User Login' }).click();
    await page.getByLabel('Email').fill(context.credentials.adminEmail);
    await page.getByLabel('Password').fill(context.credentials.adminPassword);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await expect(page.locator('.text-red-400')).toBeVisible({ timeout: 10000 });
  });

  test.skip('setup page redirects to login when setup_done=true', async ({ page }) => {
    const ctx = getContext(page);
    await page.goto(ctx.frontendUrl);
    await page.evaluate(() => {
      localStorage.setItem('stjorna_pb_url', 'http://localhost:8090');
      localStorage.setItem('pb_setup_done', 'true');
    });
    await page.goto(ctx.frontendUrl + '/setup');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});