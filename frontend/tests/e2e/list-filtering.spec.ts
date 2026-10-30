import { test, expect, getContext, getTenantId } from './helpers/test-context';
import PocketBase from 'pocketbase';

// Each test creates its own admin PB client — the `pb` export from
// global-setup lives in the main process only; workers can't see it.
async function getAdminPb(): Promise<PocketBase> {
  const client = new PocketBase('http://127.0.0.1:8090');
  await client.collection('_superusers').authWithPassword('admin@test.stjorna.local', 'admin12345678test');
  return client;
}

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function createImage(pb: PocketBase, tenantId: string, filename: string) {
  const pngBuffer = Buffer.from(PNG_BASE64, 'base64');
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
  return pb.collection('media').create(form);
}

test.describe('List filtering', () => {
  let ctx: ReturnType<typeof getContext>;

  test.beforeEach(async ({ page }) => {
    ctx = getContext(page);
    await ctx.loginAsUser();
    await ctx.waitForDashboard();
  });

  test('products: search, category and status filters', async ({ page }) => {
    const tenantId = getTenantId();
    if (!tenantId) test.skip();
    const pb = await getAdminPb();
    const stamp = Date.now();

    const catA = await pb.collection('categories').create({
      tenant: tenantId,
      name: `Filter Cat A ${stamp}`,
      slug: `filter-cat-a-${stamp}`,
      active: true,
      sort_order: 1,
    });
    const catB = await pb.collection('categories').create({
      tenant: tenantId,
      name: `Filter Cat B ${stamp}`,
      slug: `filter-cat-b-${stamp}`,
      active: true,
      sort_order: 2,
    });
    const prodA = await pb.collection('products').create({
      tenant: tenantId,
      category: catA.id,
      name: `Filter Mouse ${stamp}`,
      slug: `filter-mouse-${stamp}`,
      price: 10,
      active: true,
      sort_order: 1,
    });
    const prodB = await pb.collection('products').create({
      tenant: tenantId,
      category: catB.id,
      name: `Filter Book ${stamp}`,
      slug: `filter-book-${stamp}`,
      price: 20,
      active: false,
      sort_order: 2,
    });

    try {
      await page.goto(ctx.frontendUrl + '/products');
      await page.waitForSelector('h1:has-text("Products")', { timeout: 15000 });

      await expect(page.getByText(`Filter Mouse ${stamp}`)).toBeVisible();
      await expect(page.getByText(`Filter Book ${stamp}`)).toBeVisible();

      // Search narrows to the matching product (case-insensitive).
      await page.getByTestId('product-search').fill('mouse');
      await expect(page.getByText(`Filter Mouse ${stamp}`)).toBeVisible();
      await expect(page.getByText(`Filter Book ${stamp}`)).toHaveCount(0);
      await page.getByTestId('product-search').fill('');

      // Category filter keeps only products in the selected category.
      await page.getByTestId('product-category').fill(`Filter Cat A ${stamp}`);
      await page.locator(`[data-testid="product-category-option-${catA.id}"]`).click();
      await expect(page.getByText(`Filter Mouse ${stamp}`)).toBeVisible();
      await expect(page.getByText(`Filter Book ${stamp}`)).toHaveCount(0);

      // Clear the category filter via the dropdown's "All categories" option.
      await page.getByTestId('product-category').click();
      await page.locator('[data-testid="product-category-option-none"]').click();

      // Status filter keeps only inactive products.
      await page.getByTestId('product-status').selectOption('inactive');
      await expect(page.getByText(`Filter Book ${stamp}`)).toBeVisible();
      await expect(page.getByText(`Filter Mouse ${stamp}`)).toHaveCount(0);
    } finally {
      await pb.collection('products').delete(prodA.id);
      await pb.collection('products').delete(prodB.id);
      await pb.collection('categories').delete(catA.id);
      await pb.collection('categories').delete(catB.id);
    }
  });

  test('categories: search and status filters', async ({ page }) => {
    const tenantId = getTenantId();
    if (!tenantId) test.skip();
    const pb = await getAdminPb();
    const stamp = Date.now();

    const catA = await pb.collection('categories').create({
      tenant: tenantId,
      name: `Needle Cat ${stamp}`,
      slug: `needle-cat-${stamp}`,
      active: true,
      sort_order: 1,
    });
    const catB = await pb.collection('categories').create({
      tenant: tenantId,
      name: `Haystack Cat ${stamp}`,
      slug: `haystack-cat-${stamp}`,
      active: false,
      sort_order: 2,
    });

    try {
      await page.goto(ctx.frontendUrl + '/categories');
      await page.waitForSelector('h1:has-text("Categories")', { timeout: 15000 });

      await expect(page.getByText(`Needle Cat ${stamp}`)).toBeVisible();
      await expect(page.getByText(`Haystack Cat ${stamp}`)).toBeVisible();

      // Search narrows to the matching category (case-insensitive).
      await page.getByTestId('category-search').fill('needle');
      await expect(page.getByText(`Needle Cat ${stamp}`)).toBeVisible();
      await expect(page.getByText(`Haystack Cat ${stamp}`)).toHaveCount(0);
      await page.getByTestId('category-search').fill('');

      // Status filter keeps only inactive categories.
      await page.getByTestId('category-status').selectOption('inactive');
      await expect(page.getByText(`Haystack Cat ${stamp}`)).toBeVisible();
      await expect(page.getByText(`Needle Cat ${stamp}`)).toHaveCount(0);
    } finally {
      await pb.collection('categories').delete(catA.id);
      await pb.collection('categories').delete(catB.id);
    }
  });

  test('media: search and type filters', async ({ page }) => {
    const tenantId = getTenantId();
    if (!tenantId) test.skip();
    const pb = await getAdminPb();
    const stamp = Date.now();

    const m1 = await createImage(pb, tenantId, `needle-${stamp}.png`);
    const m2 = await createImage(pb, tenantId, `haystack-${stamp}.png`);

    try {
      await page.goto(ctx.frontendUrl + '/media');
      await page.waitForSelector('h1:has-text("Media")', { timeout: 15000 });

      await expect(page.getByText(`needle-${stamp}.png`)).toBeVisible();
      await expect(page.getByText(`haystack-${stamp}.png`)).toBeVisible();

      // Search narrows to the matching filename.
      await page.getByTestId('media-search').fill(`needle-${stamp}`);
      await expect(page.getByText(`needle-${stamp}.png`)).toBeVisible();
      await expect(page.getByText(`haystack-${stamp}.png`)).toHaveCount(0);
      await page.getByTestId('media-search').fill('');

      // Type filter: neither fixture is a video, so "Videos" yields nothing.
      await page.getByTestId('media-type').selectOption('video');
      await expect(page.getByText(`needle-${stamp}.png`)).toHaveCount(0);
      await expect(page.getByText(`haystack-${stamp}.png`)).toHaveCount(0);
    } finally {
      await pb.collection('media').delete(m1.id);
      await pb.collection('media').delete(m2.id);
    }
  });
});
