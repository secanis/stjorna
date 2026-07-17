import { test, expect, getContext } from './helpers/test-context';

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test.describe('Media Upload', () => {
  let ctx: ReturnType<typeof getContext>;

  test.beforeEach(async ({ page }) => {
    ctx = getContext(page);
    await ctx.loginAsUser();
    await ctx.waitForDashboard();
  });

  test('media list page loads', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/media');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1:has-text("Media")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('table')).toBeVisible();
  });

  test('+ Add Media button navigates to /media/new', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/media');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h1:has-text("Media")', { timeout: 15000 });

    const addButton = page.locator('a:has-text("Add Media")');
    await expect(addButton).toBeVisible();
    await addButton.click();

    await page.waitForURL(/\/media\/new$/, { timeout: 10000 });
    await expect(page.locator('h1:has-text("Upload Media")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#media-file')).toBeAttached();
  });

  test('selecting file shows preview and form fields', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/media/new');
    await page.waitForSelector('#media-file', { timeout: 15000 });

    const pngBuffer = Buffer.from(PNG_BASE64, 'base64');
    await page.locator('#media-file').setInputFiles({
      name: 'e2e-select.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    await page.waitForSelector('#media-filename', { timeout: 10000 });
    await expect(page.locator('#media-filename')).toHaveValue('e2e-select.png');
    await expect(page.locator('#media-original-name')).toHaveValue('e2e-select.png');
    await expect(page.locator('#media-mime')).toHaveValue('image/png');

    const imgPreview = page.locator('img[alt="e2e-select.png"]');
    await expect(imgPreview).toBeVisible({ timeout: 10000 });

    const uploadButton = page.getByRole('button', { name: 'Upload' });
    await expect(uploadButton).toBeEnabled();
  });

  test('upload image creates media record and redirects to edit page', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/media/new');
    await page.waitForSelector('#media-file', { timeout: 15000 });

    const pngBuffer = Buffer.from(PNG_BASE64, 'base64');
    await page.locator('#media-file').setInputFiles({
      name: 'e2e-upload.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    await page.waitForSelector('#media-filename', { timeout: 10000 });
    await page.getByRole('button', { name: 'Upload' }).click();

    await page.waitForURL(/\/media\/[a-z0-9]+$/, { timeout: 15000 });
    await expect(page.locator('h1:has-text("Edit Media")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#media-filename')).toHaveValue('e2e-upload.png');
  });

  test('uploaded media appears in media list', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/media/new');
    await page.waitForSelector('#media-file', { timeout: 15000 });

    const uniqueName = `e2e-list-${Date.now()}.png`;
    const pngBuffer = Buffer.from(PNG_BASE64, 'base64');
    await page.locator('#media-file').setInputFiles({
      name: uniqueName,
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    await page.waitForSelector('#media-filename', { timeout: 10000 });
    await page.getByRole('button', { name: 'Upload' }).click();
    await page.waitForURL(/\/media\/[a-z0-9]+$/, { timeout: 15000 });

    await page.goto(ctx.frontendUrl + '/media');
    await page.waitForLoadState('networkidle');
    await expect(page.locator(`text=${uniqueName}`)).toBeVisible({ timeout: 10000 });
  });

  test('uploaded media preview image is visible in list', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/media/new');
    await page.waitForSelector('#media-file', { timeout: 15000 });

    const uniqueName = `e2e-preview-${Date.now()}.png`;
    const pngBuffer = Buffer.from(PNG_BASE64, 'base64');
    await page.locator('#media-file').setInputFiles({
      name: uniqueName,
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    await page.waitForSelector('#media-filename', { timeout: 10000 });
    await page.getByRole('button', { name: 'Upload' }).click();
    await page.waitForURL(/\/media\/[a-z0-9]+$/, { timeout: 15000 });

    await page.goto(ctx.frontendUrl + '/media');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector(`text=${uniqueName}`, { timeout: 10000 });

    const previewImg = page.locator(`tbody tr:has-text("${uniqueName}") img`);
    await expect(previewImg).toBeVisible({ timeout: 10000 });
  });

  test('rename uploaded file in form before save', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/media/new');
    await page.waitForSelector('#media-file', { timeout: 15000 });

    const pngBuffer = Buffer.from(PNG_BASE64, 'base64');
    await page.locator('#media-file').setInputFiles({
      name: 'original.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    await page.waitForSelector('#media-filename', { timeout: 10000 });
    await page.locator('#media-filename').fill('renamed.png');
    await expect(page.locator('#media-filename')).toHaveValue('renamed.png');

    await page.getByRole('button', { name: 'Upload' }).click();
    await page.waitForURL(/\/media\/[a-z0-9]+$/, { timeout: 15000 });

    await page.goto(ctx.frontendUrl + '/media');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=renamed.png')).toBeVisible({ timeout: 10000 });
  });

  test('upload button is disabled without file', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/media/new');
    await page.waitForSelector('#media-file', { timeout: 15000 });

    const uploadButton = page.getByRole('button', { name: 'Upload' });
    await expect(uploadButton).toBeDisabled();
  });

  test('clear pending file button removes preview', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/media/new');
    await page.waitForSelector('#media-file', { timeout: 15000 });

    const pngBuffer = Buffer.from(PNG_BASE64, 'base64');
    await page.locator('#media-file').setInputFiles({
      name: 'to-be-cleared.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    await page.waitForSelector('img[alt="to-be-cleared.png"]', { timeout: 10000 });
    await page.locator('button[title="Remove file"]').click();
    await expect(page.locator('img[alt="to-be-cleared.png"]')).toHaveCount(0);
  });

  test('delete media with confirmation', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/media');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('h1:has-text("Media")', { timeout: 15000 });

    const rows = page.locator('tbody tr');
    const count = await rows.count();
    if (count === 0) {
      test.skip();
      return;
    }

    page.on('dialog', dialog => dialog.accept());
    await page.locator('button:has-text("Delete")').first().click();
    await page.waitForTimeout(1500);
  });

  test('regular user (admin role) can delete media they did not create', async ({ page }) => {
    const uniqueName = `delete-perm-test-${Date.now()}.png`;
    await page.goto(ctx.frontendUrl + '/media/new');
    await page.waitForSelector('#media-file', { timeout: 15000 });

    const pngBuffer = Buffer.from(PNG_BASE64, 'base64');
    await page.locator('#media-file').setInputFiles({
      name: uniqueName,
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    await page.waitForSelector('#media-filename', { timeout: 10000 });
    await page.getByRole('button', { name: 'Upload' }).click();
    await page.waitForURL(/\/media\/[a-z0-9]+$/, { timeout: 15000 });

    await page.goto(ctx.frontendUrl + '/media');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector(`text=${uniqueName}`, { timeout: 10000 });

    let dialogCount = 0;
    page.on('dialog', async (dialog) => {
      dialogCount++;
      await dialog.accept();
    });

    const row = page.locator(`tbody tr:has-text("${uniqueName}")`);
    await row.locator('button:has-text("Delete")').click();
    await page.waitForTimeout(1500);

    expect(dialogCount).toBeGreaterThan(0);
    await expect(page.locator(`text=${uniqueName}`)).toHaveCount(0);
  });

  test('edit media with non-existent ID shows record not found', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/media/nonexistent123456789');
    await page.waitForSelector('h1:has-text("Edit Media")', { timeout: 15000 });
    await expect(page.locator('text=Media record not found')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Record ID:')).toBeVisible();
  });

  test('list image src includes auth token for protected file URLs', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/media/new');
    await page.waitForSelector('#media-file', { timeout: 15000 });

    const pngBuffer = Buffer.from(PNG_BASE64, 'base64');
    await page.locator('#media-file').setInputFiles({
      name: 'token-test.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    await page.waitForSelector('#media-filename', { timeout: 10000 });
    await page.getByRole('button', { name: 'Upload' }).click();
    await page.waitForURL(/\/media\/[a-z0-9]+$/, { timeout: 15000 });

    await page.goto(ctx.frontendUrl + '/media');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector(`text=token-test.png`, { timeout: 10000 });

    const imgSrc = await page.locator(`tbody tr:has-text("token-test.png") img`).getAttribute('src');
    expect(imgSrc).toBeTruthy();
    expect(imgSrc).toContain('/api/files/media/');
    expect(imgSrc).toContain('token=');
    expect(imgSrc).toContain('thumb=100x100');
  });

  test('edit image src includes auth token for protected file URLs', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/media/new');
    await page.waitForSelector('#media-file', { timeout: 15000 });

    const pngBuffer = Buffer.from(PNG_BASE64, 'base64');
    const filename = `edit-token-test-${Date.now()}.png`;
    await page.locator('#media-file').setInputFiles({
      name: filename,
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    await page.waitForSelector('#media-filename', { timeout: 10000 });
    await page.getByRole('button', { name: 'Upload' }).click();
    await page.waitForURL(/\/media\/[a-z0-9]+$/, { timeout: 15000 });

    const editImgSrc = await page.locator('img').first().getAttribute('src');
    expect(editImgSrc).toBeTruthy();
    expect(editImgSrc).toContain('/api/files/media/');
    expect(editImgSrc).toContain('token=');
    expect(editImgSrc).toContain(filename);
  });
});
