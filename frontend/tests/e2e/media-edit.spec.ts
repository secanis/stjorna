import { test, expect, getContext } from './helpers/test-context';

test.describe('Media Edit Page', () => {
  let ctx: ReturnType<typeof getContext>;

  test.beforeEach(async ({ page }) => {
    ctx = getContext(page);
    await ctx.loginAsUser();
    await ctx.waitForDashboard();
  });

  async function getAdminToken(request: any) {
    const authRes = await request.post(`${ctx.pbUrl}/api/admins/auth-with-password`, {
      data: { identity: ctx.credentials.adminEmail, password: ctx.credentials.adminPassword },
    });
    expect(authRes.ok()).toBeTruthy();
    const { token } = await authRes.json();
    return token;
  }

  test('shows products and categories that use the media', async ({ page, request }) => {
    const token = await getAdminToken(request);

    const mediaRes = await request.post(`${ctx.pbUrl}/api/collections/media/records`, {
      headers: { Authorization: token },
      multipart: {
        filename: 'usage-test.png',
        original_name: 'usage-test.png',
        mime_type: 'image/png',
        size: '1024',
        tenant: ctx.tenantId!,
      },
    });
    expect(mediaRes.ok()).toBeTruthy();
    const media = await mediaRes.json();

    const categoryRes = await request.post(`${ctx.pbUrl}/api/collections/categories/records`, {
      headers: { Authorization: token },
      data: {
        name: 'Usage Category',
        slug: 'usage-category',
        tenant: ctx.tenantId,
        media: media.id,
      },
    });
    expect(categoryRes.ok()).toBeTruthy();
    const category = await categoryRes.json();

    const productRes = await request.post(`${ctx.pbUrl}/api/collections/products/records`, {
      headers: { Authorization: token },
      data: {
        name: 'Usage Product',
        slug: 'usage-product',
        tenant: ctx.tenantId,
        media: [media.id],
      },
    });
    expect(productRes.ok()).toBeTruthy();
    const product = await productRes.json();

    await page.goto(ctx.frontendUrl + `/media/${media.id}`);
    await page.waitForSelector('h1:has-text("Edit Media")', { timeout: 15000 });

    await expect(page.locator('h2:has-text("Used In")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Usage Product')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Usage Category')).toBeVisible({ timeout: 10000 });

    await page.locator('button:has-text("Usage Product")').click();
    await page.waitForURL(`**/products/${product.id}`, { timeout: 10000 });
  });

  test('delete button on edit page removes media', async ({ page, request }) => {
    const token = await getAdminToken(request);

    const mediaRes = await request.post(`${ctx.pbUrl}/api/collections/media/records`, {
      headers: { Authorization: token },
      multipart: {
        filename: 'delete-from-edit.png',
        original_name: 'delete-from-edit.png',
        mime_type: 'image/png',
        size: '1024',
        tenant: ctx.tenantId!,
      },
    });
    expect(mediaRes.ok()).toBeTruthy();
    const media = await mediaRes.json();

    await page.goto(ctx.frontendUrl + `/media/${media.id}`);
    await page.waitForSelector('h1:has-text("Edit Media")', { timeout: 15000 });

    let dialogAccepted = false;
    page.on('dialog', async (dialog) => {
      dialogAccepted = true;
      await dialog.accept();
    });

    await page.locator('button:has-text("Delete")').click();
    await page.waitForURL('**/media', { timeout: 15000 });

    expect(dialogAccepted).toBe(true);

    const listRes = await request.get(`${ctx.pbUrl}/api/collections/media/records?filter=id="${media.id}"`, {
      headers: { Authorization: token },
    });
    expect(listRes.ok()).toBeTruthy();
    const list = await listRes.json();
    expect(list.items).toHaveLength(0);
  });
});
