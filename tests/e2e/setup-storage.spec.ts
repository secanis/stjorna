import { test, expect, getContext } from './helpers/test-context';

test.describe('Setup wizard storage step', () => {
  test('storage step is reachable when no admin exists', async ({ page, request }) => {
    const ctx = getContext(page);

    const checkRes = await request.get(ctx.pbUrl + '/api/admins');
    if (checkRes.status() !== 401 && checkRes.status() !== 200) {
      test.skip();
      return;
    }
    if (checkRes.status() === 200) {
      const body = await checkRes.json();
      if (body.totalItems > 0) {
        test.skip();
        return;
      }
    }

    await page.goto(ctx.frontendUrl + '/setup');
    await page.waitForSelector('h1:has-text("STJÓRNA")', { timeout: 15000 });

    await page.locator('button:has-text("Connect")').click();
    await page.waitForSelector('label:has-text("Admin Email")', { timeout: 10000 });

    await page.locator('input[type="email"]').fill('e2e-storage-admin@stjorna.local');
    await page.locator('input[type="password"]').first().fill('test12345678pass');
    await page.locator('input[type="password"]').nth(1).fill('test12345678pass');

    await page.locator('button:has-text("Continue")').click();
    await page.waitForSelector('text=Local filesystem', { timeout: 30000 });

    await expect(page.locator('text=Local filesystem')).toBeVisible();
    await expect(page.locator('text=S3 (or S3-compatible)')).toBeVisible();
  });

  test('S3 endpoint is auto-filled from region', async ({ page, request }) => {
    const ctx = getContext(page);

    const checkRes = await request.get(ctx.pbUrl + '/api/admins');
    if (checkRes.status() !== 401 && checkRes.status() !== 200) {
      test.skip();
      return;
    }
    if (checkRes.status() === 200) {
      const body = await checkRes.json();
      if (body.totalItems > 0) {
        test.skip();
        return;
      }
    }

    await page.goto(ctx.frontendUrl + '/setup');
    await page.waitForSelector('h1:has-text("STJÓRNA")', { timeout: 15000 });

    await page.locator('button:has-text("Connect")').click();
    await page.waitForSelector('label:has-text("Admin Email")', { timeout: 10000 });

    await page.locator('input[type="email"]').fill('e2e-endpoint@stjorna.local');
    await page.locator('input[type="password"]').first().fill('test12345678pass');
    await page.locator('input[type="password"]').nth(1).fill('test12345678pass');

    await page.locator('button:has-text("Continue")').click();
    await page.waitForSelector('text=S3 (or S3-compatible)', { timeout: 30000 });

    await page.locator('text=S3 (or S3-compatible)').click();
    await page.waitForSelector('#s3-region', { timeout: 5000 });

    await page.locator('#s3-bucket').fill('test-bucket');
    await page.locator('#s3-region').fill('eu-central-1');

    await expect(page.locator('#s3-endpoint')).toHaveValue('https://s3.eu-central-1.amazonaws.com');

    await page.locator('#s3-endpoint').fill('https://custom-endpoint.example.com');
    await expect(page.locator('#s3-endpoint')).toHaveValue('https://custom-endpoint.example.com');

    await page.locator('#s3-region').fill('us-west-2');
    await expect(page.locator('#s3-endpoint')).toHaveValue('https://custom-endpoint.example.com');
  });

  test('Test S3 button is enabled when fields are valid, disabled when not', async ({ page, request }) => {
    const ctx = getContext(page);

    const checkRes = await request.get(ctx.pbUrl + '/api/admins');
    if (checkRes.status() !== 401 && checkRes.status() !== 200) {
      test.skip();
      return;
    }
    if (checkRes.status() === 200) {
      const body = await checkRes.json();
      if (body.totalItems > 0) {
        test.skip();
        return;
      }
    }

    await page.goto(ctx.frontendUrl + '/setup');
    await page.waitForSelector('h1:has-text("STJÓRNA")', { timeout: 15000 });

    await page.locator('button:has-text("Connect")').click();
    await page.waitForSelector('label:has-text("Admin Email")', { timeout: 10000 });

    await page.locator('input[type="email"]').fill('e2e-s3fields@stjorna.local');
    await page.locator('input[type="password"]').first().fill('test12345678pass');
    await page.locator('input[type="password"]').nth(1).fill('test12345678pass');

    await page.locator('button:has-text("Continue")').click();
    await page.waitForSelector('text=S3 (or S3-compatible)', { timeout: 30000 });

    await page.locator('text=S3 (or S3-compatible)').click();
    await page.waitForSelector('#s3-bucket', { timeout: 5000 });

    const testBtn = page.locator('[data-testid="s3-test-btn"]');
    await expect(testBtn).toBeDisabled();

    await page.locator('#s3-bucket').fill('test-bucket');
    await page.locator('#s3-region').fill('eu-central-1');
    await expect(testBtn).toBeEnabled();

    await page.locator('#s3-bucket').fill('');
    await expect(testBtn).toBeDisabled();
  });

  test('Test S3 does not return "not enabled" error and Continue is disabled after failure', async ({ page, request }) => {
    const ctx = getContext(page);

    const checkRes = await request.get(ctx.pbUrl + '/api/admins');
    if (checkRes.status() !== 401 && checkRes.status() !== 200) {
      test.skip();
      return;
    }
    if (checkRes.status() === 200) {
      const body = await checkRes.json();
      if (body.totalItems > 0) {
        test.skip();
        return;
      }
    }

    await page.goto(ctx.frontendUrl + '/setup');
    await page.waitForSelector('h1:has-text("STJÓRNA")', { timeout: 15000 });

    await page.locator('button:has-text("Connect")').click();
    await page.waitForSelector('label:has-text("Admin Email")', { timeout: 10000 });

    await page.locator('input[type="email"]').fill('e2e-s3test@stjorna.local');
    await page.locator('input[type="password"]').first().fill('test12345678pass');
    await page.locator('input[type="password"]').nth(1).fill('test12345678pass');

    await page.locator('button:has-text("Continue")').click();
    await page.waitForSelector('text=S3 (or S3-compatible)', { timeout: 30000 });

    await page.locator('text=S3 (or S3-compatible)').click();
    await page.waitForSelector('#s3-bucket', { timeout: 5000 });

    await page.locator('#s3-bucket').fill('definitely-does-not-exist-bucket-xyz');
    await page.locator('#s3-region').fill('eu-central-1');
    await page.locator('#s3-access-key').fill('AKIAFAKEKEY');
    await page.locator('#s3-secret-key').fill('fakesecretkey');

    const continueBtn = page.locator('button:has-text("Continue")');
    await expect(continueBtn).toBeDisabled();

    const testBtn = page.locator('[data-testid="s3-test-btn"]');
    await expect(testBtn).toBeEnabled();
    await testBtn.click();

    await expect(
      page.locator('[data-testid="s3-test-success"], [data-testid="s3-test-error"]')
    ).toBeVisible({ timeout: 30000 });

    const errorBox = page.locator('[data-testid="s3-test-error"]');
    if (await errorBox.count() > 0) {
      const errorText = await errorBox.textContent();
      expect(errorText).not.toContain('not enabled');
      expect(errorText).not.toContain('S3 storage filesystem is not enabled');
    }

    await expect(continueBtn).toBeDisabled();
  });

  test('Continue stays disabled until test passes; re-test uses new values', async ({ page, request }) => {
    const ctx = getContext(page);

    const checkRes = await request.get(ctx.pbUrl + '/api/admins');
    if (checkRes.status() !== 401 && checkRes.status() !== 200) {
      test.skip();
      return;
    }
    if (checkRes.status() === 200) {
      const body = await checkRes.json();
      if (body.totalItems > 0) {
        test.skip();
        return;
      }
    }

    await page.goto(ctx.frontendUrl + '/setup');
    await page.waitForSelector('h1:has-text("STJÓRNA")', { timeout: 15000 });

    await page.locator('button:has-text("Connect")').click();
    await page.waitForSelector('label:has-text("Admin Email")', { timeout: 10000 });

    await page.locator('input[type="email"]').fill('e2e-s3retest@stjorna.local');
    await page.locator('input[type="password"]').first().fill('test12345678pass');
    await page.locator('input[type="password"]').nth(1).fill('test12345678pass');

    await page.locator('button:has-text("Continue")').click();
    await page.waitForSelector('text=S3 (or S3-compatible)', { timeout: 30000 });

    await page.locator('text=S3 (or S3-compatible)').click();
    await page.waitForSelector('#s3-bucket', { timeout: 5000 });

    const continueBtn = page.locator('button:has-text("Continue")');
    await expect(continueBtn).toBeDisabled();

    await page.locator('#s3-bucket').fill('bucket-v1');
    await page.locator('#s3-region').fill('eu-central-1');
    await page.locator('#s3-access-key').fill('AKIAFAKEKEY');
    await page.locator('#s3-secret-key').fill('fakesecretkey');

    const testBtn = page.locator('[data-testid="s3-test-btn"]');
    await testBtn.click();
    await expect(
      page.locator('[data-testid="s3-test-success"], [data-testid="s3-test-error"]')
    ).toBeVisible({ timeout: 30000 });
    await expect(continueBtn).toBeDisabled();

    await page.locator('#s3-bucket').fill('bucket-v2');
    await expect(continueBtn).toBeDisabled();

    await testBtn.click();
    await expect(
      page.locator('text=/bucket-v2/')
    ).toBeVisible({ timeout: 30000 });
  });
});
