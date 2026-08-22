import { test, expect, getContext } from './helpers/test-context';

/**
 * Tenant switch refresh bug — locks in the fix.
 *
 * Before this commit:
 *   - Non-admin user picks a different tenant from the header
 *     dropdown. The page below (e.g. /media) does NOT refetch —
 *     it keeps showing the previous tenant's records.
 *   - Sidebar count badges (Media N, Categories N, Products N,
 *     Users N) stay at the previous tenant's totals.
 *
 * Root cause:
 *   - Most tenant-scoped pages use createResource with a source
 *     accessor that doesn't read `authStore.currentTenant` (or
 *     don't use createResource at all). The fetcher reads
 *     getCurrentTenant() imperatively — localStorage only —
 *     so a Solid reactivity bump on the signal never re-runs
 *     the resource.
 *   - Sidebar's createEffect tracked `sidebarStore.version`, but
 *     switchTenant never bumped that counter (only CRUD mutations
 *     did).
 *
 * Fix:
 *   - New `tenantStore.version` counter, bumped from auth.ts
 *     `switchTenant` and `logout`.
 *   - Tenant-scoped pages (MediaList, CategoryList, ProductList,
 *     Activities, Dashboard, UserManagement) include
 *     `tenantStore.version()` in their createResource source so
 *     a refire happens on tenant change.
 *   - Dashboard reads stats imperatively; added a createEffect
 *     on tenantStore.version instead.
 *   - Sidebar's createEffect now reads BOTH tenantStore.version
 *     and sidebarStore.version — switchTenant now flows through.
 *
 * What this locks in:
 *   1. After a tenant switch, the page below shows records from
 *      the new tenant (not the previous one).
 *   2. Sidebar count badges reflect the new tenant's counts.
 *   3. The header label updates to the new tenant's name.
 *   4. Switching back also re-fetches (round-trip invariant).
 */
test.describe('Tenant switch refresh — page + sidebar badges', () => {
  /** Helper: list of all cells text in the active tbody, joined by ' | '. */
  async function tbodyCellsText(page: any): Promise<string> {
    return page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('tbody tr td'));
      return cells.map((c) => (c.textContent || '').trim()).join(' | ');
    });
  }

  /** Helper: read the sidebar badge text for an entity link. */
  async function sidebarBadge(page: any, path: string): Promise<string | null> {
    return page.locator(`a[href="${path}"] span`).last().textContent();
  }

  /** Switch tenant via the header dropdown UI. */
  async function switchViaDropdown(page: any, tenantLabel: string) {
    const trigger = page.locator('div.relative.group').filter({ hasText: 'Test Company' }).first();
    await trigger.hover();
    await page.waitForTimeout(300);
    const opt = page.locator(`button:has-text("${tenantLabel}")`).first();
    await expect(opt).toBeVisible({ timeout: 5000 });
    await opt.click();
    await page.waitForTimeout(1500);
  }

  test('switch to a different tenant — /media shows the new tenant records and sidebar badge updates', async ({ page, request }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });

    // Admin-authenticated API helper to seed a SECOND tenant plus a
    // media record in it (seed only carries media in testTenant).
    const authRes = await request.post(`${ctx.pbUrl}/api/admins/auth-with-password`, {
      data: { identity: ctx.credentials.adminEmail, password: ctx.credentials.adminPassword },
    });
    const { token } = await authRes.json();
    const authHeader = { Authorization: token };

    const usersRes = await request.get(`${ctx.pbUrl}/api/collections/users/records?perPage=500`, { headers: authHeader });
    const testUser = (await usersRes.json()).items.find((u: any) => u.email === ctx.credentials.userEmail);
    expect(testUser, 'test user exists').toBeTruthy();

    const rolesRes = await request.get(`${ctx.pbUrl}/api/collections/roles/records?perPage=20`, { headers: authHeader });
    const editorRole = (await rolesRes.json()).items.find((r: any) => r.name === 'editor');

    const stamp = Date.now();
    const newTenantRes = await request.post(`${ctx.pbUrl}/api/collections/tenants/records`, {
      headers: authHeader,
      data: { name: `Switch T ${stamp}`, slug: `switch-t-${stamp}`, plan: 'starter' },
    });
    const newTenant = (await newTenantRes.json());
    expect(newTenant.id).toBeTruthy();
    await request.post(`${ctx.pbUrl}/api/collections/user_tenants/records`, {
      headers: authHeader,
      data: { user: testUser.id, tenant: newTenant.id, role: editorRole.id },
    });

    // Upload a media file in the new tenant so its /media is non-empty
    // (the alternative empty state is hard to distinguish from a stale
    //  row from the old tenant).
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const pngBuffer = Buffer.from(pngBase64, 'base64');
    const filename = `switch-t-${stamp}.png`;
    await request.post(`${ctx.pbUrl}/api/collections/media/records`, {
      headers: authHeader,
      multipart: {
        file: { name: filename, mimeType: 'image/png', buffer: pngBuffer },
        filename,
        original_name: filename,
        mime_type: 'image/png',
        size: String(pngBuffer.length),
        width: '1',
        height: '1',
        usage_count: '0',
        tenant: newTenant.id,
      },
    });

    // Hand off: clear admin session, login as test user.
    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await ctx.loginAsUser();
    await page.waitForSelector('h1:has-text("Dashboard")');

    // Force initial scope to Test Company so the BEFORE assertion has
    // a known starting dataset.
    const tenantsRes = await request.get(`${ctx.pbUrl}/api/collections/tenants/records?perPage=500`, { headers: authHeader });
    const seedTenant = (await tenantsRes.json()).items.find((t: any) => t.name === 'Test Company');
    await page.evaluate((id) => localStorage.setItem('stjorna_current_tenant', id), seedTenant.id);

    // Visit /media — bounded to Test Company (seed image).
    await page.goto(ctx.frontendUrl + '/media');
    await page.waitForTimeout(1500);

    const beforeCells = await tbodyCellsText(page);
    expect(beforeCells).toContain('test-image.png');
    expect(await sidebarBadge(page, '/media')).toBe('1');

    // Click the dropdown, choose the new tenant.
    await switchViaDropdown(page, `Switch T ${stamp}`);

    // After the switch: page shows the NEW tenant's media, sidebar
    // badge still 1 (same count, different content), header label
    // reflects the new tenant.
    const afterCells = await tbodyCellsText(page);
    expect(afterCells).toContain(filename);
    expect(afterCells).not.toContain('test-image.png');
    expect(await sidebarBadge(page, '/media')).toBe('1');
    const headerLabel = await page.locator('div.relative.group > div > span').first().textContent();
    expect(headerLabel).toContain(`Switch T`);
  });

  test('switch back — round-trip also re-fetches', async ({ page, request }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });

    const authRes = await request.post(`${ctx.pbUrl}/api/admins/auth-with-password`, {
      data: { identity: ctx.credentials.adminEmail, password: ctx.credentials.adminPassword },
    });
    const { token } = await authRes.json();
    const authHeader = { Authorization: token };

    const usersRes = await request.get(`${ctx.pbUrl}/api/collections/users/records?perPage=500`, { headers: authHeader });
    const testUser = (await usersRes.json()).items.find((u: any) => u.email === ctx.credentials.userEmail);
    const rolesRes = await request.get(`${ctx.pbUrl}/api/collections/roles/records?perPage=20`, { headers: authHeader });
    const editorRole = (await rolesRes.json()).items.find((r: any) => r.name === 'editor');

    const stamp = Date.now();
    const newTenantRes = await request.post(`${ctx.pbUrl}/api/collections/tenants/records`, {
      headers: authHeader,
      data: { name: `Round T ${stamp}`, slug: `round-t-${stamp}`, plan: 'starter' },
    });
    const newTenant = (await newTenantRes.json());
    await request.post(`${ctx.pbUrl}/api/collections/user_tenants/records`, {
      headers: authHeader,
      data: { user: testUser.id, tenant: newTenant.id, role: editorRole.id },
    });

    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await ctx.loginAsUser();
    await page.waitForSelector('h1:has-text("Dashboard")');

    // Force start in Test Company.
    const tenantsRes = await request.get(`${ctx.pbUrl}/api/collections/tenants/records?perPage=500`, { headers: authHeader });
    const seedTenant = (await tenantsRes.json()).items.find((t: any) => t.name === 'Test Company');
    await page.evaluate((id) => localStorage.setItem('stjorna_current_tenant', id), seedTenant.id);

    await page.goto(ctx.frontendUrl + '/media');
    await page.waitForTimeout(1500);

    expect(await tbodyCellsText(page)).toContain('test-image.png');

    // Switch forward
    await switchViaDropdown(page, `Round T ${stamp}`);
    expect(await tbodyCellsText(page)).not.toContain('test-image.png');
    void newTenant;

    // Switch back
    await switchViaDropdown(page, 'Test Company');
    expect(await tbodyCellsText(page)).toContain('test-image.png');
  });

  test('sidebar badge count drops to 0 when switching to an empty tenant', async ({ page, request }) => {
    // Variation of the first test: switch to a tenant with NO media
    // and verify the sidebar Media count goes to 0 — locks in the
    // exact failure mode the bug report named.
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });

    const authRes = await request.post(`${ctx.pbUrl}/api/admins/auth-with-password`, {
      data: { identity: ctx.credentials.adminEmail, password: ctx.credentials.adminPassword },
    });
    const { token } = await authRes.json();
    const authHeader = { Authorization: token };

    const usersRes = await request.get(`${ctx.pbUrl}/api/collections/users/records?perPage=500`, { headers: authHeader });
    const testUser = (await usersRes.json()).items.find((u: any) => u.email === ctx.credentials.userEmail);
    const rolesRes = await request.get(`${ctx.pbUrl}/api/collections/roles/records?perPage=20`, { headers: authHeader });
    const editorRole = (await rolesRes.json()).items.find((r: any) => r.name === 'editor');

    const stamp = Date.now();
    const newTenantRes = await request.post(`${ctx.pbUrl}/api/collections/tenants/records`, {
      headers: authHeader,
      data: { name: `Empty T ${stamp}`, slug: `empty-t-${stamp}`, plan: 'starter' },
    });
    const newTenant = (await newTenantRes.json());
    await request.post(`${ctx.pbUrl}/api/collections/user_tenants/records`, {
      headers: authHeader,
      data: { user: testUser.id, tenant: newTenant.id, role: editorRole.id },
    });
    void newTenant;

    await page.evaluate(() => localStorage.clear()).catch(() => {});
    await ctx.loginAsUser();
    await page.waitForSelector('h1:has-text("Dashboard")');

    const tenantsRes = await request.get(`${ctx.pbUrl}/api/collections/tenants/records?perPage=500`, { headers: authHeader });
    const seedTenant = (await tenantsRes.json()).items.find((t: any) => t.name === 'Test Company');
    await page.evaluate((id) => localStorage.setItem('stjorna_current_tenant', id), seedTenant.id);

    await page.goto(ctx.frontendUrl + '/media');
    await page.waitForTimeout(1500);

    expect(await sidebarBadge(page, '/media')).toBe('1');

    await switchViaDropdown(page, `Empty T ${stamp}`);

    // After switching to a tenant with no media records:
    //  - Sidebar shows 0.
    //  - Page shows the empty-state row (text "No media items yet").
    expect(await sidebarBadge(page, '/media')).toBe('0');
    const cells = await tbodyCellsText(page);
    expect(cells).toContain('No media items yet');
    expect(cells).not.toContain('test-image.png');
  });
});
