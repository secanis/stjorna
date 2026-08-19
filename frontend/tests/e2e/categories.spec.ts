import { test, expect, getContext, getTenantId } from './helpers/test-context';
import PocketBase from 'pocketbase';

// Each test creates its own PB client. The `pb` export from global-setup
// is defined in the main process only; worker processes can't see it.
async function getAdminPb(): Promise<PocketBase> {
  const pb = new PocketBase('http://localhost:8090');
  await pb.admins.authWithPassword('admin@test.stjorna.local', 'admin12345678test');
  return pb;
}

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

    test('selected media block renders with image when media assigned', async ({ page }) => {
      const tenantId = getTenantId();
      if (!tenantId) test.skip();

      const pb = await getAdminPb();

      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const pngBuffer = Buffer.from(pngBase64, 'base64');
      const filename = `cat-media-test-${Date.now()}.png`;

      const form = new FormData();
      form.append('file', new File([pngBuffer], filename, { type: 'image/png' }));
      form.append('filename', filename);
      form.append('original_name', filename);
      form.append('mime_type', 'image/png');
      form.append('size', String(pngBuffer.length));
      form.append('width', '1');
      form.append('height', '1');
      form.append('usage_count', '0');
      form.append('tenant', tenantId);
      const mediaRecord = await pb.collection('media').create(form);

      const uniqueSlug = `cat-with-media-${Date.now()}`;
      const category = await pb.collection('categories').create({
        tenant: tenantId,
        name: 'Category With Media',
        slug: uniqueSlug,
        description: 'Has an image assigned',
        active: true,
        sort_order: 1,
        media: mediaRecord.id,
      });

      await page.goto(`${ctx.frontendUrl}/categories/${category.id}`);
      await page.waitForSelector('#cat-name', { timeout: 15000 });

      const block = page.locator('[data-testid="cat-selected-media"]');
      await expect(block).toBeVisible({ timeout: 10000 });

      const box = await block.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(80);

      const img = block.locator('img');
      await expect(img).toBeVisible({ timeout: 10000 });

      await page.screenshot({
        path: 'test-results/edit-category-selected-media.png',
        fullPage: true,
      });
    });

    test('selected media block stays tall when image fails to load', async ({ page }) => {
      const tenantId = getTenantId();
      if (!tenantId) test.skip();

      const pb = await getAdminPb();

      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const pngBuffer = Buffer.from(pngBase64, 'base64');
      const filename = `cat-broken-media-${Date.now()}.png`;

      const form = new FormData();
      form.append('file', new File([pngBuffer], filename, { type: 'image/png' }));
      form.append('filename', filename);
      form.append('original_name', filename);
      form.append('mime_type', 'image/png');
      form.append('size', String(pngBuffer.length));
      form.append('width', '1');
      form.append('height', '1');
      form.append('usage_count', '0');
      form.append('tenant', tenantId);
      const mediaRecord = await pb.collection('media').create(form);

      const uniqueSlug = `cat-broken-media-${Date.now()}`;
      const category = await pb.collection('categories').create({
        tenant: tenantId,
        name: 'Category Broken Media',
        slug: uniqueSlug,
        description: 'Media file URL will 404',
        active: true,
        sort_order: 1,
        media: mediaRecord.id,
      });

      await page.route('**/api/files/media/**', (route) =>
        route.fulfill({ status: 404, body: 'stubbed' })
      );

      await page.goto(`${ctx.frontendUrl}/categories/${category.id}`);
      await page.waitForSelector('#cat-name', { timeout: 15000 });

      const block = page.locator('[data-testid="cat-selected-media"]');
      await expect(block).toBeVisible({ timeout: 10000 });

      const box = await block.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(80);

      const fallback = block.locator('[data-testid="cat-selected-media-fallback"]');
      await expect(fallback).toBeVisible({ timeout: 10000 });
      await expect(fallback).toContainText(filename);

      await page.screenshot({
        path: 'test-results/edit-category-broken-media.png',
        fullPage: true,
      });

      await page.unroute('**/api/files/media/**');
    });
  });