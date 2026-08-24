import { test, expect, getContext } from './helpers/test-context';
import PocketBase from 'pocketbase';

// Spins up a brand-new tenant with predictable data so the stats page
// has something to render. Reuses the e2e harness's PB client so it
// talks to the same container the FE is hitting.
async function seedTenant(pb: PocketBase, opts: { name: string; plan?: string }) {
  const t = await pb.collection('tenants').create({
    name: opts.name,
    slug: opts.name.toLowerCase().replace(/\s+/g, '-') + '-' + Math.random().toString(36).slice(2, 8),
    plan: opts.plan ?? 'starter',
  });
  await pb.collection('categories').create({
    tenant: t.id,
    name: 'Sample Category',
    slug: 'sample-category-' + Math.random().toString(36).slice(2, 8),
    description: 'Seed category',
    active: true,
    sort_order: 1,
  });
  await pb.collection('products').create({
    tenant: t.id,
    name: 'Sample Product',
    slug: 'sample-product-' + Math.random().toString(36).slice(2, 8),
    price: 9.99,
    description: 'Seed product',
    active: true,
    sort_order: 1,
  });
  await pb.collection('media').create({
    tenant: t.id,
    filename: 'seed-image.png',
    original_name: 'seed-image.png',
    mime_type: 'image/png',
    size: 4096,
    width: 100,
    height: 100,
  });
  return t;
}

test.describe('Tenant statistics', () => {
  test('admin sees Stats link in Tenants table and reaches the page', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    const t = await seedTenant(ctx.pb, { name: 'Stats Admin Tenant' });

    await page.goto(ctx.frontendUrl + '/tenants');
    await expect(page.getByRole('heading', { name: 'Tenants' })).toBeVisible();
    // The Stats button next to the seeded tenant.
    await page.locator(`button:has-text("Stats")`).first().click();
    await page.waitForURL(/\/tenants\/[^/]+\/stats/);
    await expect(page.getByRole('heading', { name: /statistics/i })).toBeVisible();

    // Wait for the snapshot to land (snapshot sections render after fetch).
    await expect(page.getByRole('heading', { name: 'Records' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Storage' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Last 30 days' })).toBeVisible();

    // Our seeded tenant: 1 category, 1 product, 1 media.
    await expect(page.getByText('Products', { exact: true }).first()).toBeVisible();
    // Cleanup
    await ctx.pb.collection('tenants').delete(t.id);
  });

  test('tenant user lands on /stats from sidebar and sees own tenant data', async ({ page }) => {
    const ctx = getContext(page);
    // The e2e harness seeds a test tenant with one category + one media file
    // for the regular user. So the user-side stats view should already have
    // data once we navigate to it.
    await ctx.loginAsUser();
    await page.goto(ctx.frontendUrl + '/stats');
    await expect(page.getByRole('heading', { name: /Statistics/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Records' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Storage' })).toBeVisible();
  });

  test('non-admin tenant user redirected from /tenants/:id/stats', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    // Pick any id — the page should bounce non-admins.
    await page.goto(ctx.frontendUrl + '/tenants/anything/stats');
    await page.waitForURL('**/');
    await ctx.waitForDashboard();
  });

  test('admin without ?tenant= in URL is blocked from /stats (uses current tenant context)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    // Admin has no current tenant selected yet → page should show a friendly error.
    await page.goto(ctx.frontendUrl + '/stats');
    await expect(page.getByRole('heading', { name: /Statistics/i })).toBeVisible();
    // Either a red error banner OR a successful snapshot — both prove the
    // page loaded and didn't crash. We check the error banner shape because
    // for a fresh admin session the current tenant is unset.
    const errorVisible = await page.locator('text=/Failed to load stats|Pick a tenant/').count();
    expect(errorVisible).toBeGreaterThan(0);
  });
});
