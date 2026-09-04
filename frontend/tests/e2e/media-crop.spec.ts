import { test, expect, getContext } from './helpers/test-context';

test.describe('Media Image Cropping', () => {
  let ctx: ReturnType<typeof getContext>;

  test.beforeEach(async ({ page }) => {
    ctx = getContext(page);
    await ctx.loginAsUser();
    await ctx.waitForDashboard();
  });

  test('cropper modal opens and applies crop to existing image', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/media/new');
    await page.locator('#media-file').waitFor({ state: 'attached', timeout: 15000 });

    await page.locator('#media-file').setInputFiles('tests/fixtures/test-image.png');

    await page.locator('#media-filename').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByRole('button', { name: 'Upload' }).click();

    await page.waitForURL(/\/media\/[a-z0-9]+$/, { timeout: 15000 });
    await expect(page.locator('h1:has-text("Edit Media")')).toBeVisible({ timeout: 10000 });

    const editButton = page.locator('button[title="Edit image"]');
    await expect(editButton).toBeVisible({ timeout: 10000 });
    await editButton.click();

    const dialog = page.getByRole('dialog', { name: 'Image cropper' });
    await expect(dialog).toBeVisible({ timeout: 10000 });

    // Wait for the cropper image to be ready before applying.
    await page.waitForSelector('[data-part="image"][data-ready]', { timeout: 15000 });

    const applyButton = page.getByRole('button', { name: 'Apply Crop' });
    await expect(applyButton).toBeEnabled({ timeout: 10000 });
    await applyButton.click();

    await expect(dialog).toHaveCount(0, { timeout: 10000 });
    await expect(page.locator('h1:has-text("Edit Media")')).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/media\/[a-z0-9]+$/);

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page.locator('text=Media saved successfully!')).toBeVisible({ timeout: 15000 });
  });

  test('cropper modal closes on cancel', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/media/new');
    await page.locator('#media-file').waitFor({ state: 'attached', timeout: 15000 });

    await page.locator('#media-file').setInputFiles('tests/fixtures/test-image.png');

    await page.locator('#media-filename').waitFor({ state: 'visible', timeout: 10000 });
    await page.getByRole('button', { name: 'Upload' }).click();

    await page.waitForURL(/\/media\/[a-z0-9]+$/, { timeout: 15000 });

    await page.locator('button[title="Edit image"]').click();

    const dialog = page.getByRole('dialog', { name: 'Image cropper' });
    await expect(dialog).toBeVisible({ timeout: 10000 });

    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0, { timeout: 10000 });
  });
});
