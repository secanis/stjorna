import { test, expect, getContext } from './helpers/test-context';

test.describe('Add button colors', () => {
  let ctx: ReturnType<typeof getContext>;

  test.beforeEach(async ({ page }) => {
    ctx = getContext(page);
    await ctx.loginAsUser();
    await ctx.waitForDashboard();
  });

  test('Categories: + Add Category is purple', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/categories');
    await page.waitForSelector('h1:has-text("Categories")');
    const btn = page.locator('a:has-text("Add Category")');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveClass(/bg-purple-600/);
    await expect(btn).toHaveClass(/hover:bg-purple-700/);
  });

  test('Products: + Add Product is emerald', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/products');
    await page.waitForSelector('h1:has-text("Products")');
    const btn = page.locator('a:has-text("Add Product")');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveClass(/bg-emerald-600/);
    await expect(btn).toHaveClass(/hover:bg-emerald-700/);
  });

  test('Media: + Add Media is blue', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/media');
    await page.waitForSelector('h1:has-text("Media")');
    const btn = page.locator('a:has-text("Add Media")');
    await expect(btn).toBeVisible();
    await expect(btn).toHaveClass(/bg-blue-600/);
    await expect(btn).toHaveClass(/hover:bg-blue-700/);
  });

  test('Dashboard: all Quick Actions buttons use entity colors', async ({ page }) => {
    await expect(page.locator('a:has-text("Add Category")')).toHaveClass(/bg-purple-600/);
    await expect(page.locator('a:has-text("Add Media")')).toHaveClass(/bg-blue-600/);
    await expect(page.locator('a:has-text("Add Product")')).toHaveClass(/bg-emerald-600/);
  });

  test('Dashboard: stat card icons match entity colors', async ({ page }) => {
    // The stat-card grid is the first grid inside the main content with
    // the exact class signature. Each card is a child div with the icon
    // as its first child SVG.
    const grid = page.locator('main div.grid.grid-cols-2').first();
    await expect(grid).toBeVisible();

    // Find the card whose label text matches and assert its icon color.
    const expectIconColor = async (label: string, colorClass: RegExp) => {
      const card = grid.locator('div', { has: page.locator(`text=${label}`) }).first();
      const icon = card.locator('svg').first();
      await expect(icon, `icon for ${label}`).toHaveClass(colorClass);
    };

    await expectIconColor('Products', /text-emerald-600/);
    await expectIconColor('Categories', /text-purple-600/);
    await expectIconColor('Media', /text-blue-600/);
    await expectIconColor('Users', /text-cyan-600/);
  });
});
