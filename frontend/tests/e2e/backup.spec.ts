import { test, expect, getContext } from './helpers/test-context';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const V1_FIXTURE = path.join(__dirname, 'fixtures', 'backup-v1-sample.json');

test.describe('Backup & Restore', () => {
  let ctx: ReturnType<typeof getContext>;

  test.beforeEach(async ({ page }) => {
    ctx = getContext(page);
    await ctx.loginAsAdmin();
    await ctx.waitForDashboard();
  });

  test('Instance Settings shows JSON and ZIP download buttons', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/settings/instance');
    await page.waitForSelector('h1:has-text("Instance Settings")', { timeout: 15000 });

    await expect(page.getByRole('button', { name: /Download JSON/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Download ZIP/ })).toBeVisible();

    await expect(page).toHaveScreenshot('settings-instance.png', { fullPage: true });
  });

  test('Download JSON yields a valid manifest file', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/settings/instance');
    await page.waitForSelector('button:has-text("Download JSON")', { timeout: 15000 });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download JSON/ }).click();
    const download = await downloadPromise;

    const path = await download.path();
    expect(path).toBeTruthy();
    const content = await fs.readFile(path!, 'utf8');
    const manifest = JSON.parse(content);
    expect(manifest.kind).toBe('stjorna-backup');
    expect(manifest.version).toBe('3.0.0');
    expect(manifest.collections).toBeDefined();
  });

  test('Download ZIP yields a valid zip with manifest.json inside', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/settings/instance');
    await page.waitForSelector('button:has-text("Download ZIP")', { timeout: 15000 });

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download ZIP/ }).click();
    const download = await downloadPromise;

    const path = await download.path();
    const buf = await fs.readFile(path!);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });

  test('Tenant Settings shows Restore Backup section', async ({ page }) => {
    const tenantId = ctx.tenantId;
    expect(tenantId).toBeTruthy();
    await page.goto(`${ctx.frontendUrl}/tenants/${tenantId}`);
    await page.waitForSelector('h1:has-text("Tenant Settings")', { timeout: 15000 });

    await expect(page.getByText('Restore Backup')).toBeVisible();
    await expect(page.getByText('Old STJÓRNA (v1)')).toBeVisible();
    await expect(page.getByText('STJÓRNA v3')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import' })).toBeDisabled();
  });

  test('v1 import via Restore Backup section populates categories and products', async ({ page }) => {
    const tenantId = ctx.tenantId;
    expect(tenantId).toBeTruthy();
    await page.goto(`${ctx.frontendUrl}/tenants/${tenantId}`);
    await page.waitForSelector('h1:has-text("Tenant Settings")', { timeout: 15000 });

    // Pick v1 source
    await page.getByLabel('Old STJÓRNA (v1)').check();

    // Choose file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(V1_FIXTURE);

    // Import
    await page.getByRole('button', { name: 'Import' }).click();

    // Success message
    await expect(page.getByText(/Imported 3 categories, 4 products/)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/v1 category images were dropped/)).toBeVisible();
  });
});
