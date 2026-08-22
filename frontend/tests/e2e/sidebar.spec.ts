import { test, expect, getContext } from './helpers/test-context';

test.describe('Sidebar', () => {
  test('PB admin sees dashboard, settings, users, tenants, activities', async ({ page }) => {
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
    await expect(sidebar.locator('a[href="/activities"]')).toBeVisible();

    const tenantsCount = sidebar.locator('a[href="/tenants"] span').first();
    await expect(tenantsCount).toBeVisible();
  });

  test('regular user sees dashboard, media, categories, products, activities, settings', async ({ page }) => {
    const context = getContext(page);
    await context.loginAsUser();
    await page.waitForSelector('aside');
    await page.waitForTimeout(2000);

    const sidebar = page.locator('aside');
    await expect(sidebar.locator('text=Dashboard')).toBeVisible();
    await expect(sidebar.locator('a[href="/media"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/categories"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/products"]')).toBeVisible();
    await expect(sidebar.locator('a[href="/activities"]')).toBeVisible();
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

  test('sidebar product count updates after creating a product', async ({ page }) => {
    const context = getContext(page);
    await context.loginAsUser();
    await context.waitForDashboard();

    const sidebar = page.locator('aside');
    const productsLink = sidebar.locator('a[href="/products"]');
    const countBefore = await productsLink.locator('span').last().textContent();

    await page.goto(context.frontendUrl + '/products/new');
    await page.waitForSelector('#prod-name', { timeout: 15000 });
    const uniqueSlug = `sidebar-count-test-${Date.now()}`;
    await page.locator('#prod-name').fill('Sidebar Count Test Product');
    await page.locator('#prod-slug').fill(uniqueSlug);
    await page.getByRole('button', { name: 'Save Product' }).click();
    await page.waitForURL(/\/products$/, { timeout: 15000 });

    await page.waitForTimeout(1500);

    const countAfter = await productsLink.locator('span').last().textContent();
    expect(countAfter).not.toBe(countBefore);
  });

  test('sidebar category count updates after creating a category', async ({ page }) => {
    const context = getContext(page);
    await context.loginAsUser();
    await context.waitForDashboard();

    const sidebar = page.locator('aside');
    const categoriesLink = sidebar.locator('a[href="/categories"]');
    const countBefore = await categoriesLink.locator('span').last().textContent();

    await page.goto(context.frontendUrl + '/categories/new');
    await page.waitForSelector('#cat-name', { timeout: 15000 });
    const uniqueSlug = `sidebar-cat-count-${Date.now()}`;
    await page.locator('#cat-name').fill('Sidebar Cat Count Test');
    await page.locator('#cat-slug').fill(uniqueSlug);
    await page.getByRole('button', { name: 'Save Category' }).click();
    await page.waitForURL(/\/categories$/, { timeout: 15000 });

    await page.waitForTimeout(1500);

    const countAfter = await categoriesLink.locator('span').last().textContent();
    expect(countAfter).not.toBe(countBefore);
  });
});