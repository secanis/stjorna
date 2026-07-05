import { test, expect, getContext } from './helpers/test-context';

  test.describe('Categories', () => {
    let ctx: ReturnType<typeof getContext>;

    test.beforeEach(async ({ page }) => {
      ctx = getContext(page);
      await ctx.loginAsUser();
      await ctx.waitForDashboard();
    });

    test('category list page loads with existing categories', async ({ page }) => {
      await page.goto(ctx.frontendUrl + '/categories');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('h1:has-text("Categories")')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('table')).toBeVisible();
      const rows = page.locator('tbody tr');
      await expect(rows).not.toHaveCount(0);
    });

    test('create new category', async ({ page }) => {
      const uniqueSlug = `e2e-test-category-${Date.now()}`;
      await page.goto(ctx.frontendUrl + '/categories/new');
      await page.waitForSelector('#cat-name', { timeout: 15000 });
      await page.waitForTimeout(500);

      await page.locator('#cat-name').fill('E2E Test Category');
      await page.locator('#cat-slug').fill(uniqueSlug);
      await page.locator('#cat-desc').fill('Created by E2E test');
      
      await page.getByRole('button', { name: 'Save Category' }).click();

      await page.waitForURL(/\/categories$/, { timeout: 15000 });
      await expect(page.locator('text=E2E Test Category')).toBeVisible();
    });

    test('edit existing category', async ({ page }) => {
      await page.goto(ctx.frontendUrl + '/categories');
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('h1:has-text("Categories")', { timeout: 15000 });

      const rows = page.locator('tbody tr');
      await expect(rows).not.toHaveCount(0);

      const editButton = page.locator('button:has-text("Edit")').first();
      await editButton.click();

      await page.waitForURL(/\/categories\/.+/, { timeout: 15000 });
      await page.waitForSelector('#cat-name', { timeout: 15000 });

      await page.locator('#cat-name').fill('Updated Category Name');
      await page.getByRole('button', { name: 'Save Category' }).click();

      await page.waitForURL(/\/categories$/, { timeout: 15000 });
      await expect(page.locator('text=Updated Category Name')).toBeVisible();
    });

    test('toggle category active status', async ({ page }) => {
      await page.goto(ctx.frontendUrl + '/categories');
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('h1:has-text("Categories")', { timeout: 15000 });

      const toggleButtons = page.locator('button:has-text("Yes")').or(page.locator('button:has-text("No")'));
      const firstToggle = toggleButtons.first();
      const initialText = await firstToggle.textContent();
      await firstToggle.click();
      await page.waitForTimeout(500);
      const newText = await firstToggle.textContent();
      expect(newText).not.toEqual(initialText);
    });

    test('delete category with confirmation', async ({ page }) => {
      await page.goto(ctx.frontendUrl + '/categories');
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('h1:has-text("Categories")', { timeout: 15000 });

      const rows = page.locator('tbody tr');
      const count = await rows.count();
      if (count === 0) return;

      page.on('dialog', dialog => dialog.accept());
      await page.locator('button:has-text("Delete")').first().click();
      await page.waitForTimeout(1000);
    });
  });