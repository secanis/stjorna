import { test, expect, getContext } from './helpers/test-context';

test.describe('Sidebar', () => {
  test('PB admin sees dashboard, settings, users, tenants', async ({ page }) => {
    const context = getContext(page);
    await context.loginAsAdmin();
    await context.waitForDashboard();

    const sidebar = page.locator('aside');
    await expect(sidebar.locator('text=Dashboard')).toBeVisible();
    await expect(sidebar.locator('text=Media')).toBeHidden();
    await expect(sidebar.locator('text=Categories')).toBeHidden();
    await expect(sidebar.locator('text=Products')).toBeHidden();
    await expect(sidebar.locator('text=Settings')).toBeVisible();
    await expect(sidebar.locator('text=Users')).toBeVisible();
    await expect(sidebar.locator('text=Tenants')).toBeVisible();

    const tenantsCount = sidebar.locator('a[href="/tenants"] span').first();
    await expect(tenantsCount).toBeVisible();
  });

  test('regular user sees dashboard, media, categories, products, settings', async ({ page }) => {
    const context = getContext(page);
    await context.loginAsUser();
    await page.waitForSelector('aside');
    await page.waitForTimeout(2000);

    const sidebar = page.locator('aside');
    await expect(sidebar.locator('text=Dashboard')).toBeVisible();
    await expect(sidebar.locator('a[href="/media"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/categories"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/products"]')).toBeVisible();
    await expect(sidebar.locator('text=Settings')).toBeVisible();
    await expect(sidebar.locator('a[href="/users"]')).toBeHidden();
    await expect(sidebar.locator('a[href="/tenants"]')).toBeHidden();
  });

  test('active nav item is highlighted', async ({ page }) => {
    const context = getContext(page);
    await context.loginAsUser();
    await context.waitForDashboard();

    const sidebar = page.locator('aside');
    const dashboardLink = sidebar.locator('a[href="/"]');
    await expect(dashboardLink).toHaveClass(/bg-blue-600/);

    await page.goto(context.frontendUrl + '/categories');
    await page.waitForSelector('h1:has-text("Categories")');
    const categoriesLink = sidebar.locator('a[href="/categories"]');
    await expect(categoriesLink).toHaveClass(/bg-blue-600/);
  });
});