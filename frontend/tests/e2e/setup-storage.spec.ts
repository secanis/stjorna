import { APIRequestContext, Page } from '@playwright/test';
import { test, expect, getContext, TestContext } from './helpers/test-context';

/**
 * Setup wizard — storage step.
 *
 * T-04.2: these tests used to probe the PB v0.22 `/api/admins` endpoint to
 * decide whether the wizard was reachable and self-skipped on v0.40 (404).
 * They now drive the wizard through the real state:
 *
 *   - GET /api/stjorna/setup-status reports `superuserExists` / `setupDone`.
 *   - The e2e global setup always creates a superuser and marks setup as
 *     done, and the wizard redirects to /login while `setupDone` is true.
 *     Each test therefore flips `instance_settings.setup_done` to false
 *     (as the superuser), walks step 1 in *login* mode with the existing
 *     superuser, and restores the flag afterwards so the other specs keep
 *     seeing a configured instance.
 */

async function superuserToken(ctx: TestContext, request: APIRequestContext): Promise<string> {
  const res = await request.post(ctx.pbUrl + '/api/collections/_superusers/auth-with-password', {
    data: { identity: ctx.credentials.adminEmail, password: ctx.credentials.adminPassword },
  });
  expect(res.ok(), 'superuser login for setup_done toggling').toBeTruthy();
  return (await res.json()).token as string;
}

async function setSetupDone(ctx: TestContext, request: APIRequestContext, value: boolean): Promise<void> {
  const token = await superuserToken(ctx, request);
  const headers = { Authorization: token };
  const list = await request.get(ctx.pbUrl + '/api/collections/instance_settings/records?perPage=1', { headers });
  expect(list.ok()).toBeTruthy();
  const items = (await list.json()).items as Array<{ id: string }>;
  if (items.length > 0) {
    const res = await request.patch(ctx.pbUrl + '/api/collections/instance_settings/records/' + items[0].id, {
      headers,
      data: { setup_done: value },
    });
    expect(res.ok()).toBeTruthy();
  } else {
    const res = await request.post(ctx.pbUrl + '/api/collections/instance_settings/records', {
      headers,
      data: { setup_done: value },
    });
    expect(res.ok()).toBeTruthy();
  }
  const status = await request.get(ctx.pbUrl + '/api/stjorna/setup-status');
  expect((await status.json()).setupDone).toBe(value);
}

/** Step 1 (login mode, a superuser already exists) → storage step. */
async function openStorageStep(page: Page, ctx: TestContext): Promise<void> {
  await page.goto(ctx.frontendUrl + '/setup');
  await expect(page.locator('h1:has-text("STJÓRNA")')).toBeVisible({ timeout: 15000 });
  // Login mode: no "Confirm password" / "Setup token" fields.
  await expect(page.getByText('Log in with the PocketBase superuser that already exists')).toBeVisible();
  await page.locator('input[type="email"]').fill(ctx.credentials.adminEmail);
  await page.locator('input[type="password"]').first().fill(ctx.credentials.adminPassword);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.locator('text=Local filesystem')).toBeVisible({ timeout: 30000 });
}

test.describe('Setup wizard storage step', () => {
  let ctx: TestContext;

  test.beforeEach(async ({ page, request }) => {
    ctx = getContext(page);
    const status = await request.get(ctx.pbUrl + '/api/stjorna/setup-status');
    expect(status.status()).toBe(200);
    const body = await status.json();
    // The wizard's login mode needs an existing superuser.
    expect(body.superuserExists).toBe(true);
    await setSetupDone(ctx, request, false);
  });

  test.afterEach(async ({ request }) => {
    await setSetupDone(ctx, request, true);
  });

  test('storage step is reachable after superuser login', async ({ page }) => {
    await openStorageStep(page, ctx);
    await expect(page.locator('text=Local filesystem')).toBeVisible();
    await expect(page.locator('text=S3 (or S3-compatible)')).toBeVisible();
  });

  test('S3 endpoint is auto-filled from region', async ({ page }) => {
    await openStorageStep(page, ctx);

    await page.locator('text=S3 (or S3-compatible)').click();
    await expect(page.locator('#s3-region')).toBeVisible({ timeout: 5000 });

    await page.locator('#s3-bucket').fill('test-bucket');
    await page.locator('#s3-region').fill('eu-central-1');

    await expect(page.locator('#s3-endpoint')).toHaveValue('https://s3.eu-central-1.amazonaws.com');

    await page.locator('#s3-endpoint').fill('https://custom-endpoint.example.com');
    await expect(page.locator('#s3-endpoint')).toHaveValue('https://custom-endpoint.example.com');

    await page.locator('#s3-region').fill('us-west-2');
    await expect(page.locator('#s3-endpoint')).toHaveValue('https://custom-endpoint.example.com');
  });

  test('Test S3 button is enabled when fields are valid, disabled when not', async ({ page }) => {
    await openStorageStep(page, ctx);

    await page.locator('text=S3 (or S3-compatible)').click();
    await expect(page.locator('#s3-bucket')).toBeVisible({ timeout: 5000 });

    const testBtn = page.locator('[data-testid="s3-test-btn"]');
    await expect(testBtn).toBeDisabled();

    await page.locator('#s3-bucket').fill('test-bucket');
    await page.locator('#s3-region').fill('eu-central-1');
    await page.locator('#s3-access-key').fill('AKIAFAKEKEY');
    await page.locator('#s3-secret-key').fill('fakesecretkey');
    await expect(testBtn).toBeEnabled();

    await page.locator('#s3-bucket').fill('');
    await expect(testBtn).toBeDisabled();
  });

  // The verify step really uploads through PocketBase, so the tests point
  // at an endpoint that can never answer (connection refused on loopback)
  // instead of sending fake credentials to AWS. Against a real AWS
  // endpoint the outcome depends on the bucket name — PocketBase accepts
  // the upload for an existing foreign bucket even with bogus keys — which
  // made the old version of these tests non-deterministic.
  const UNREACHABLE_ENDPOINT = 'http://127.0.0.1:1';

  async function fillS3(page: Page, bucket: string): Promise<void> {
    await page.locator('#s3-bucket').fill(bucket);
    await page.locator('#s3-region').fill('eu-central-1');
    await page.locator('#s3-endpoint').fill(UNREACHABLE_ENDPOINT);
    await page.locator('#s3-access-key').fill('AKIAFAKEKEY');
    await page.locator('#s3-secret-key').fill('fakesecretkey');
  }

  test('Test S3 does not return "not enabled" error and Continue is disabled after failure', async ({ page }) => {
    await openStorageStep(page, ctx);

    await page.locator('text=S3 (or S3-compatible)').click();
    await expect(page.locator('#s3-bucket')).toBeVisible({ timeout: 5000 });
    await fillS3(page, 'definitely-does-not-exist-bucket-xyz');

    const continueBtn = page.getByRole('button', { name: 'Continue', exact: true });
    await expect(continueBtn).toBeDisabled();

    const testBtn = page.locator('[data-testid="s3-test-btn"]');
    await expect(testBtn).toBeEnabled();
    await testBtn.click();

    const errorBox = page.locator('[data-testid="s3-test-error"]');
    await expect(errorBox).toBeVisible({ timeout: 30000 });
    const errorText = (await errorBox.textContent()) || '';
    expect(errorText).not.toContain('not enabled');
    expect(errorText).not.toContain('S3 storage filesystem is not enabled');

    await expect(continueBtn).toBeDisabled();
  });

  test('Continue stays disabled until test passes; re-test uses new values', async ({ page }) => {
    await openStorageStep(page, ctx);

    await page.locator('text=S3 (or S3-compatible)').click();
    await expect(page.locator('#s3-bucket')).toBeVisible({ timeout: 5000 });

    const continueBtn = page.getByRole('button', { name: 'Continue', exact: true });
    await expect(continueBtn).toBeDisabled();

    await fillS3(page, 'bucket-v1');

    const testBtn = page.locator('[data-testid="s3-test-btn"]');
    const firstSave = page.waitForRequest((r) => r.url().endsWith('/api/settings') && r.method() === 'PATCH');
    await testBtn.click();
    expect((await firstSave).postData() || '').toContain('bucket-v1');
    await expect(page.locator('[data-testid="s3-test-error"]')).toBeVisible({ timeout: 30000 });
    await expect(continueBtn).toBeDisabled();

    await page.locator('#s3-bucket').fill('bucket-v3');
    await expect(continueBtn).toBeDisabled();

    // Re-test must send the CURRENT form values, not the ones from the
    // first attempt.
    const secondSave = page.waitForRequest((r) => r.url().endsWith('/api/settings') && r.method() === 'PATCH');
    await testBtn.click();
    const body = (await secondSave).postData() || '';
    expect(body).toContain('bucket-v3');
    expect(body).not.toContain('bucket-v1');
    await expect(page.locator('[data-testid="s3-test-error"]')).toBeVisible({ timeout: 30000 });
    await expect(continueBtn).toBeDisabled();
  });
});
