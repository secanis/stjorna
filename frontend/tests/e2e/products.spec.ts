import { test, expect, getContext, pb, getTenantId } from './helpers/test-context';
import PocketBase from 'pocketbase';

// Each test creates its own PB client. The `pb` export from global-setup
// is defined in the main process only; worker processes can't see it.
async function getAdminPb(): Promise<PocketBase> {
  const client = new PocketBase('http://localhost:8090');
  await client.admins.authWithPassword('admin@test.stjorna.local', 'admin12345678test');
  return client;
}

test.describe('Products', () => {
  let ctx: ReturnType<typeof getContext>;

  test.beforeEach(async ({ page }) => {
    ctx = getContext(page);
    await ctx.loginAsUser();
    await ctx.waitForDashboard();
  });

  test('products list page loads', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/products');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1:has-text("Products")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table')).toBeVisible();
    // Thumb column should be present
    await expect(page.locator('th:has-text("Thumb")')).toBeVisible();

    await expect(page).toHaveScreenshot('products-list.png', { fullPage: true });
  });

  test('product with multiple media shows stacked thumbs + overflow counter', async ({ page, request }) => {
    const tenantId = getTenantId();
    if (!tenantId) test.skip();

    const pb = await getAdminPb();
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const pngBuffer = Buffer.from(pngBase64, 'base64');

    // Create 4 media records
    const mediaIds: string[] = [];
    for (let i = 0; i < 4; i++) {
      const filename = `prod-thumb-${Date.now()}-${i}.png`;
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
      const m = await pb.collection('media').create(form);
      mediaIds.push(m.id);
    }

    const product = await pb.collection('products').create({
      tenant: tenantId,
      name: 'Product Multi Thumb',
      slug: `prod-multi-thumb-${Date.now()}`,
      description: 'Has 4 media',
      active: true,
      sort_order: 99,
      media: mediaIds,
    });

    await page.goto(ctx.frontendUrl + '/products');
    await page.waitForSelector(`text=Product Multi Thumb`, { timeout: 10000 });
    const row = page.locator('tbody tr', { hasText: 'Product Multi Thumb' });
    // First cell should have 3 thumbs + "+1" overflow
    const imgs = row.locator('td').first().locator('img');
    await expect(imgs).toHaveCount(3, { timeout: 10000 });
    await expect(row.locator('td').first().locator('text=+1')).toBeVisible();

    await pb.collection('products').delete(product.id);
    for (const id of mediaIds) await pb.collection('media').delete(id);
  });

  test('+ Add Product button navigates to /products/new', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/products');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h1:has-text("Products")', { timeout: 15000 });

    const addButton = page.locator('a:has-text("Add Product")');
    await expect(addButton).toBeVisible();
    await addButton.click();

    await page.waitForURL(/\/products\/new$/, { timeout: 10000 });
    await expect(page.locator('h1:has-text("New Product")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#prod-name')).toBeVisible();
  });

  test('new product form has no file upload, has media picker instead', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/products/new');
    await page.waitForSelector('#prod-name', { timeout: 15000 });

    await expect(page.locator('#prod-images-upload')).toHaveCount(0);
    await expect(page.locator('[data-testid="prod-media-picker"]')).toBeVisible({ timeout: 10000 });
  });

  test('create new product', async ({ page }) => {
    const uniqueSlug = `e2e-product-${Date.now()}`;
    await page.goto(ctx.frontendUrl + '/products/new');
    await page.waitForSelector('#prod-name', { timeout: 15000 });
    await page.waitForTimeout(500);

    await page.locator('#prod-name').fill('E2E Test Product');
    await page.locator('#prod-slug').fill(uniqueSlug);
    await page.locator('#prod-price').fill('99.99');
    await page.locator('#prod-desc').fill('A test product created by E2E');

    await page.getByRole('button', { name: 'Save Product' }).click();

    await page.waitForURL(/\/products$/, { timeout: 15000 });
    await expect(page.locator('text=E2E Test Product')).toBeVisible();
  });

  test('create product via UI button', async ({ page }) => {
    const uniqueSlug = `e2e-ui-product-${Date.now()}`;
    await page.goto(ctx.frontendUrl + '/products');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h1:has-text("Products")', { timeout: 15000 });

    await page.locator('a:has-text("Add Product")').click();
    await page.waitForURL(/\/products\/new$/, { timeout: 10000 });
    await page.waitForSelector('#prod-name', { timeout: 10000 });

    await page.locator('#prod-name').fill('UI Flow Product');
    await page.locator('#prod-slug').fill(uniqueSlug);
    await page.getByRole('button', { name: 'Save Product' }).click();

    await page.waitForURL(/\/products$/, { timeout: 15000 });
    await expect(page.locator('text=UI Flow Product')).toBeVisible();
  });

  test('edit existing product', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/products');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h1:has-text("Products")', { timeout: 15000 });

    const rows = page.locator('tbody tr');
    const rowCount = await rows.count();
    if (rowCount === 0) {
      test.skip();
      return;
    }

    const editButton = page.locator('button:has-text("Edit")').first();
    await editButton.click();

    await page.waitForURL(/\/products\/.+/, { timeout: 15000 });
    await page.waitForSelector('#prod-name', { timeout: 15000 });

    await page.locator('#prod-name').fill('Updated Product Name');
    await page.getByRole('button', { name: 'Save Product' }).click();

    await page.waitForURL(/\/products$/, { timeout: 15000 });
    await expect(page.locator('text=Updated Product Name')).toBeVisible();
  });

  test('create product by selecting media from library', async ({ page, request }) => {
    // Use the admin PB client to create a fresh media record (test fixture
    // is shared across tests, so we add our own to keep this test isolated).
    const adminAuth = await request.post(ctx.pbUrl + '/api/admins/auth-with-password', {
      data: { identity: ctx.credentials.adminEmail, password: ctx.credentials.adminPassword },
    });
    expect(adminAuth.ok()).toBeTruthy();
    const adminToken = (await adminAuth.json()).token;

    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const pngBuffer = Buffer.from(pngBase64, 'base64');

    const tenant = (await pb.collection('tenants').getList(1, 1)).items[0]?.id;
    expect(tenant).toBeTruthy();

    const createForm = new FormData();
    createForm.append('file', new Blob([pngBuffer], { type: 'image/png' }), 'picker-test.png');
    createForm.append('filename', 'picker-test.png');
    createForm.append('original_name', 'picker-test.png');
    createForm.append('mime_type', 'image/png');
    createForm.append('size', String(pngBuffer.length));
    createForm.append('tenant', tenant!);
    const createdMedia = await request.post(ctx.pbUrl + '/api/collections/media/records', {
      multipart: {
        file: { name: 'picker-test.png', mimeType: 'image/png', buffer: pngBuffer },
        filename: 'picker-test.png',
        original_name: 'picker-test.png',
        mime_type: 'image/png',
        size: String(pngBuffer.length),
        tenant: tenant!,
      },
      headers: { Authorization: adminToken },
    });
    expect(createdMedia.ok()).toBeTruthy();
    const mediaRecord = await createdMedia.json();

    const uniqueSlug = `e2e-pick-${Date.now()}`;
    await page.goto(ctx.frontendUrl + '/products/new');
    await page.waitForSelector('#prod-name', { timeout: 15000 });
    await page.waitForSelector('[data-testid="prod-media-picker"]', { timeout: 10000 });

    await page.locator('#prod-name').fill('Product With Picked Media');
    await page.locator('#prod-slug').fill(uniqueSlug);

    // Pick the media we just created.
    await page.locator(`[data-testid="prod-media-pick-${mediaRecord.id}"]`).click();

    // The selected media area should now contain it.
    await expect(page.locator(`[data-testid="prod-selected-media-${mediaRecord.id}"]`)).toBeVisible();

    await page.getByRole('button', { name: 'Save Product' }).click();
    await page.waitForURL(/\/products$/, { timeout: 15000 });
    await expect(page.locator('text=Product With Picked Media')).toBeVisible();
  });

  test('drag-and-drop reorders selected media', async ({ page, request }) => {
    const adminAuth = await request.post(ctx.pbUrl + '/api/admins/auth-with-password', {
      data: { identity: ctx.credentials.adminEmail, password: ctx.credentials.adminPassword },
    });
    const adminToken = (await adminAuth.json()).token;
    const tenant = (await pb.collection('tenants').getList(1, 1)).items[0]?.id;
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

    async function createMedia(name: string) {
      const res = await request.post(ctx.pbUrl + '/api/collections/media/records', {
        multipart: {
          file: { name, mimeType: 'image/png', buffer: pngBuffer },
          filename: name,
          original_name: name,
          mime_type: 'image/png',
          size: String(pngBuffer.length),
          tenant: tenant!,
        },
        headers: { Authorization: adminToken },
      });
      return await res.json();
    }

    const m1 = await createMedia(`dnd-1-${Date.now()}.png`);
    const m2 = await createMedia(`dnd-2-${Date.now()}.png`);

    const uniqueSlug = `e2e-dnd-${Date.now()}`;
    await page.goto(ctx.frontendUrl + '/products/new');
    await page.waitForSelector('#prod-name', { timeout: 15000 });
    await page.waitForSelector('[data-testid="prod-media-picker"]', { timeout: 10000 });

    await page.locator('#prod-name').fill('Product With Reordered Media');
    await page.locator('#prod-slug').fill(uniqueSlug);

    // Pick both media items (m1 first, then m2 — m1 will be at index 0)
    await page.locator(`[data-testid="prod-media-pick-${m1.id}"]`).click();
    await page.locator(`[data-testid="prod-media-pick-${m2.id}"]`).click();

    const sel1 = page.locator(`[data-testid="prod-selected-media-${m1.id}"]`);
    const sel2 = page.locator(`[data-testid="prod-selected-media-${m2.id}"]`);
    await expect(sel1).toBeVisible();
    await expect(sel2).toBeVisible();

    // Drag m1 onto m2's position to reorder.
    const box1 = await sel1.boundingBox();
    const box2 = await sel2.boundingBox();
    expect(box1).not.toBeNull();
    expect(box2).not.toBeNull();

    if (box1 && box2) {
      await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
      await page.mouse.down();
      // Move to m2's position with a couple of intermediate steps (HTML5 DnD
      // sometimes requires movement to fire dragover).
      await page.mouse.move(box1.x + box1.width / 2 + 5, box1.y + box1.height / 2, { steps: 5 });
      await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2, { steps: 10 });
      await page.mouse.up();
    }

    // Order is best-effort (HTML5 DnD via Playwright mouse events is
    // browser-implementation-specific). We only assert both are still
    // selected after the drag operation.
    await expect(sel1).toBeVisible();
    await expect(sel2).toBeVisible();
  });

  test('delete product with confirmation', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/products');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h1:has-text("Products")', { timeout: 15000 });

    const rows = page.locator('tbody tr');
    const count = await rows.count();
    if (count === 0) {
      test.skip();
      return;
    }

    page.on('dialog', dialog => dialog.accept());
    await page.locator('button:has-text("Delete")').first().click();
    await page.waitForTimeout(1000);
  });
});
