import { test, expect, getContext } from './helpers/test-context';

test.describe('Media list filter', () => {
  let ctx: ReturnType<typeof getContext>;

  test.beforeEach(async ({ page }) => {
    ctx = getContext(page);
    await ctx.loginAsUser();
    await ctx.waitForDashboard();
  });

  test('Images filter shows only image rows; Videos only video rows; All shows both', async ({ page, request }) => {
    // Seed one image and one video record via admin API.
    const authRes = await request.post(`${ctx.pbUrl}/api/admins/auth-with-password`, {
      data: { identity: 'admin@test.stjorna.local', password: 'admin12345678test' },
    });
    const { token } = await authRes.json();
    const authHeader = { Authorization: token };

    const tenantsRes = await request.get(`${ctx.pbUrl}/api/collections/tenants/records?perPage=1`, { headers: authHeader });
    const tenantId = (await tenantsRes.json()).items[0].id;

    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const pngBuffer = Buffer.from(pngBase64, 'base64');

    // Image: real PNG (1x1) with ftyp-shaped header so PB's content sniffer accepts image/png
    const imgFilename = `filter-img-${Date.now()}.png`;
    const imgRes = await request.post(`${ctx.pbUrl}/api/collections/media/records`, {
      headers: authHeader,
      multipart: {
        file: { name: imgFilename, mimeType: 'image/png', buffer: pngBuffer },
        filename: imgFilename,
        original_name: imgFilename,
        mime_type: 'image/png',
        size: String(pngBuffer.length),
        tenant: tenantId,
      },
    });
    expect(imgRes.status()).toBe(200);
    const imgRecord = await imgRes.json();

    // Video: minimal MP4 with ftyp box at the start
    const ftyp = Buffer.from([
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70,
      0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
      0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
      0x61, 0x76, 0x63, 0x31, 0x6d, 0x70, 0x34, 0x31,
    ]);
    const videoBuffer = Buffer.concat([ftyp, Buffer.alloc(20 * 1024, 0xab)]);
    const videoFilename = `filter-vid-${Date.now()}.mp4`;
    const videoRes = await request.post(`${ctx.pbUrl}/api/collections/media/records`, {
      headers: authHeader,
      multipart: {
        file: { name: videoFilename, mimeType: 'video/mp4', buffer: videoBuffer },
        filename: videoFilename,
        original_name: videoFilename,
        mime_type: 'video/mp4',
        size: String(videoBuffer.length),
        tenant: tenantId,
      },
    });
    expect(videoRes.status()).toBe(200);
    const videoRecord = await videoRes.json();

    // Open the media list and verify each filter state.
    await page.goto(ctx.frontendUrl + '/media');
    await page.waitForSelector('h1:has-text("Media")');
    const select = page.locator('select');

    const rowCount = async () => page.locator('tbody tr').count();

    // Default ("All types"): both rows must be visible.
    await expect(select).toHaveValue('');
    const allCount = await rowCount();
    expect(allCount).toBeGreaterThanOrEqual(2);

    // Switch to Images: only the image row remains.
    await select.selectOption('image');
    // Wait for the video row to disappear.
    await expect(page.locator(`tbody tr:has-text("${videoFilename}")`)).toHaveCount(0, { timeout: 10000 });
    await expect(page.locator(`tbody tr:has-text("${imgFilename}")`)).toHaveCount(1);

    // Switch to Videos: only the video row remains.
    await select.selectOption('video');
    await expect(page.locator(`tbody tr:has-text("${imgFilename}")`)).toHaveCount(0, { timeout: 10000 });
    await expect(page.locator(`tbody tr:has-text("${videoFilename}")`)).toHaveCount(1);

    // Back to All: both rows return.
    await select.selectOption('');
    await expect(page.locator(`tbody tr:has-text("${imgFilename}")`)).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator(`tbody tr:has-text("${videoFilename}")`)).toHaveCount(1);

    // Cleanup
    await request.delete(`${ctx.pbUrl}/api/collections/media/records/${imgRecord.id}`);
    await request.delete(`${ctx.pbUrl}/api/collections/media/records/${videoRecord.id}`);
  });
});