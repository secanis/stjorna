import { test, expect, getContext, getTenantId } from './helpers/test-context';
import PocketBase from 'pocketbase';

// T-15: list pagination used to ignore the page signal (always page 1),
// and products.custom_fields (a JSON field) was rendered as
// "[object Object]" and written back as that literal string.

async function getAdminPb(): Promise<PocketBase> {
  const client = new PocketBase('http://127.0.0.1:8090');
  await client.collection('_superusers').authWithPassword('admin@test.stjorna.local', 'admin12345678test');
  return client;
}

test.describe('Products: pagination and custom_fields', () => {
  let ctx: ReturnType<typeof getContext>;

  test.beforeEach(async ({ page }) => {
    ctx = getContext(page);
    await ctx.loginAsUser();
    await ctx.waitForDashboard();
  });

  test('page 2 of products shows different rows than page 1', async ({ page }) => {
    const tenantId = getTenantId();
    if (!tenantId) test.skip();

    const pb = await getAdminPb();
    const stamp = Date.now();
    const created: string[] = [];
    // 51+ rows guarantee a second page at PER_PAGE = 50. Use a sort_order
    // well above the rest of the fixtures so the paginated slice is
    // predictable: the last created row ends up on page 2.
    const existing = await pb.collection('products').getList(1, 1, {
      filter: pb.filter('tenant = {:t}', { t: tenantId }),
    });
    const needed = Math.max(0, 51 - existing.totalItems);
    for (let i = 0; i < needed + 1; i++) {
      const rec = await pb.collection('products').create({
        tenant: tenantId,
        name: `Paged ${stamp} ${String(i).padStart(3, '0')}`,
        slug: `paged-${stamp}-${i}`,
        active: true,
        sort_order: 100000 + i,
      });
      created.push(rec.id);
    }
    const lastName = `Paged ${stamp} ${String(needed).padStart(3, '0')}`;

    try {
      await page.goto(ctx.frontendUrl + '/products');
      await expect(page.locator('h1:has-text("Products")')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('text=/Page 1 of [2-9]/')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('tbody tr', { hasText: lastName })).toHaveCount(0);
      const firstRowPage1 = await page.locator('tbody tr').first().innerText();

      await page.getByRole('button', { name: 'Next' }).click();
      await expect(page.locator('text=/Page 2 of/')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('tbody tr', { hasText: lastName })).toBeVisible({ timeout: 10000 });
      const firstRowPage2 = await page.locator('tbody tr').first().innerText();
      expect(firstRowPage2).not.toBe(firstRowPage1);
    } finally {
      for (const id of created) {
        await pb.collection('products').delete(id).catch(() => {});
      }
    }
  });

  test('custom_fields JSON round-trips through the editor', async ({ page }) => {
    const tenantId = getTenantId();
    if (!tenantId) test.skip();

    const pb = await getAdminPb();
    const original = { color: 'red', sizes: [1, 2], nested: { ok: true } };
    const product = await pb.collection('products').create({
      tenant: tenantId,
      name: `CF Roundtrip ${Date.now()}`,
      slug: `cf-roundtrip-${Date.now()}`,
      active: true,
      custom_fields: original,
    });

    try {
      await page.goto(ctx.frontendUrl + `/products/${product.id}`);
      const textarea = page.locator('#prod-custom-fields');
      await expect(textarea).toBeVisible({ timeout: 15000 });
      const shown = await textarea.inputValue();
      expect(shown).not.toContain('[object Object]');
      expect(JSON.parse(shown)).toEqual(original);

      // Invalid JSON is rejected client-side and nothing is written.
      await textarea.fill('{not json');
      await page.getByRole('button', { name: /save/i }).click();
      await expect(page.locator('text=/valid JSON/i')).toBeVisible({ timeout: 5000 });
      const unchanged = await pb.collection('products').getOne(product.id);
      expect(unchanged.custom_fields).toEqual(original);

      // A valid edit is persisted as a JSON object, not a string.
      const updated = { color: 'blue', extra: 'x' };
      await textarea.fill(JSON.stringify(updated));
      await page.getByRole('button', { name: /save/i }).click();
      await expect
        .poll(async () => (await pb.collection('products').getOne(product.id)).custom_fields, { timeout: 10000 })
        .toEqual(updated);
    } finally {
      await pb.collection('products').delete(product.id).catch(() => {});
    }
  });
});
