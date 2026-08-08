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

    test('+ Add Category button navigates to /categories/new', async ({ page }) => {
      await page.goto(ctx.frontendUrl + '/categories');
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('h1:has-text("Categories")', { timeout: 15000 });

      const addButton = page.locator('a:has-text("Add Category")');
      await expect(addButton).toBeVisible();
      await addButton.click();

      await page.waitForURL(/\/categories\/new$/, { timeout: 10000 });
      await expect(page.locator('h1:has-text("New Category")')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#cat-name')).toBeVisible();
    });

    test('create new category via direct URL', async ({ page }) => {
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

    test('create new category via UI button', async ({ page }) => {
      const uniqueSlug = `e2e-ui-category-${Date.now()}`;
      await page.goto(ctx.frontendUrl + '/categories');
      await page.waitForLoadState('networkidle');
      await page.waitForSelector('h1:has-text("Categories")', { timeout: 15000 });

      await page.locator('a:has-text("Add Category")').click();
      await page.waitForURL(/\/categories\/new$/, { timeout: 10000 });
      await page.waitForSelector('#cat-name', { timeout: 10000 });

      await page.locator('#cat-name').fill('UI Flow Category');
      await page.locator('#cat-slug').fill(uniqueSlug);
      await page.getByRole('button', { name: 'Save Category' }).click();

      await page.waitForURL(/\/categories$/, { timeout: 15000 });
      await expect(page.locator('text=UI Flow Category')).toBeVisible();
    });

    test('slug is auto-generated from name', async ({ page }) => {
      await page.goto(ctx.frontendUrl + '/categories/new');
      await page.waitForSelector('#cat-name', { timeout: 15000 });

      await page.locator('#cat-name').fill('My Auto Slug Test');

      const slugValue = await page.locator('#cat-slug').inputValue();
      expect(slugValue).toBe('my-auto-slug-test');
    });

    test('slug is NOT overridden after user edits it manually', async ({ page }) => {
      await page.goto(ctx.frontendUrl + '/categories/new');
      await page.waitForSelector('#cat-name', { timeout: 15000 });

      await page.locator('#cat-slug').fill('custom-slug');
      await page.locator('#cat-name').fill('A Different Name');

      const slugValue = await page.locator('#cat-slug').inputValue();
      expect(slugValue).toBe('custom-slug');
    });

    test('manually edited slug gets normalized on input', async ({ page }) => {
      await page.goto(ctx.frontendUrl + '/categories/new');
      await page.waitForSelector('#cat-name', { timeout: 15000 });

      await page.locator('#cat-slug').fill('My Custom Slug With Spaces');

      const slugValue = await page.locator('#cat-slug').inputValue();
      expect(slugValue).toBe('my-custom-slug-with-spaces');
    });

    test('product slug is auto-generated from name', async ({ page }) => {
      await page.goto(ctx.frontendUrl + '/products/new');
      await page.waitForSelector('#prod-name', { timeout: 15000 });

      await page.locator('#prod-name').fill('My Product Name');

      const slugValue = await page.locator('#prod-slug').inputValue();
      expect(slugValue).toBe('my-product-name');
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