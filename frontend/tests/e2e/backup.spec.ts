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

  test('General Settings documents tenant-scoped backup (no instance-level download buttons)', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/settings/general');
    await page.waitForSelector('h1:has-text("General Settings")', { timeout: 15000 });

    await expect(page.getByText(/Tenant-scoped export\/import is/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Download JSON/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Download ZIP/ })).toHaveCount(0);
  });

  test('Download ZIP yields a valid zip with manifest.json inside', async ({ page }) => {
    const tenantId = ctx.tenantId;
    expect(tenantId).toBeTruthy();
    await page.goto(`${ctx.frontendUrl}/tenants/${tenantId}`);
    await page.waitForSelector('h1:has-text("Tenant Settings")', { timeout: 15000 });
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
    expect(buf.includes('manifest.json')).toBe(true);
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
    await expect(page.getByText(/v1 category image references ignored/)).toBeVisible();
  });
});
