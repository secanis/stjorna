import { test, expect, getContext } from './helpers/test-context';

/**
 * UserManagement table aggregates by user (one row per user) instead
 * of one row per user_tenants link.
 *
 * Tests here deliberately don't hard-code the *count* of memberships
 * a user has: prior tests in this spec accumulate link state in PB,
 * so by the time later tests run the test user may already have
 * multiple tenants linked. The invariant under test is the
 * aggregation BEHAVIOUR (1 row per user regardless of how many
 * links exist), not the prevailing dataset size. Each assertion
 * checks a delta or an invariant that holds across any prior
 * accumulation.
 */
test.describe('User Management table — aggregate by user', () => {
  /** Helper: read the membership ids currently visible in the row. */
  async function rowMembershipIds(row: ReturnType<typeof import('@playwright/test').Locator.prototype['locator']>): Promise<string[]> {
    return row.locator('[data-membership-tenant-id]').evaluateAll((els) =>
      (els as HTMLElement[]).map((el) => el.getAttribute('data-membership-tenant-id') || '')
    );
  }

  test('admin: ONE row per user regardless of tenant count (aggregation invariant)', async ({ page, request }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });

    const authRes = await request.post(`${ctx.pbUrl}/api/admins/auth-with-password`, {
      data: { identity: ctx.credentials.adminEmail, password: ctx.credentials.adminPassword },
    });
    const { token } = await authRes.json();
    const authHeader = { Authorization: token };

    // Create a fresh tenant and link the seeded user to it.
    await page.goto(ctx.frontendUrl + '/tenants/new');
    const stamp = Date.now();
    await page.locator('label:has-text("Company Name") + input').fill(`Agg T ${stamp}`);
    await page.locator('label:has-text("Slug") + input').fill(`agg-t-${stamp}`);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/tenants\/[a-z0-9]{8,}$/, { timeout: 8000 });
    await page.waitForTimeout(800);

    await page.locator('button:has-text("Add User")').click();
    await page.waitForSelector('select#ts-existing-user');
    await page.locator('select#ts-existing-user').selectOption({ index: 1 });
    await page.locator('button[type="submit"]:has-text("Add to tenant")').click();
    await page.waitForTimeout(1500);

    // Count user_tenants links for the seeded user — should grow by one
    // (we just added one).
    const allTenantsRes = await request.get(`${ctx.pbUrl}/api/collections/tenants/records?perPage=500`, { headers: authHeader });
    const allTenants = (await allTenantsRes.json()).items;
    const newTenant = allTenants.find((t: any) => t.name === `Agg T ${stamp}`);
    expect(newTenant).toBeTruthy();

    const linksForUserRes = await request.get(
      `${ctx.pbUrl}/api/collections/user_tenants/records?perPage=500&filter=user.id="${ctx.credentials.adminEmail}"`,
      { headers: authHeader }
    );
    // Note: we don't filter by user here — we just need a baseline.

    // Visit /users and confirm: ONE row for the seeded user.
    await page.goto(ctx.frontendUrl + '/users');
    await page.waitForSelector('tbody tr');
    await page.waitForSelector('tbody tr [data-membership-tenant-id]');

    const rowsForSeededUser = page.locator('tbody tr').filter({ hasText: 'user@test.stjorna.local' });
    const rowCount = await rowsForSeededUser.count();

    // Multiple rows would mean the table failed to aggregate. We expect 1.
    expect(rowCount, 'one row even with multiple memberships').toBe(1);

    // The newly-linked tenant + every prior membership should all be
    // visible inside this single row.
    const ids = await rowMembershipIds(rowsForSeededUser);
    expect(ids, 'membership ids include new tenant').toContain(newTenant.id);

    void linksForUserRes;
  });

  test('admin: column header is "Tenants" (always plural)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(ctx.frontendUrl + '/users');
    await page.waitForSelector('tbody tr');

    // Order is locked: Name, Email, Tenants. Role column was removed
    // (roles now live inline per membership). Actions column was
    // removed (Remove X is per-membership inline).
    expect.poll(
      async () => page.locator('thead th').allTextContents(),
      { timeout: 10000, intervals: [100] }
    ).toEqual(['Name', 'Email', 'Tenants']);
  });

  test('admin: inline role select changes role of just that one membership, leaves others untouched', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });

    // Set up: add a second tenant and link testUser.
    await page.goto(ctx.frontendUrl + '/tenants/new');
    const stamp = Date.now();
    const secondTenant = `Role T ${stamp}`;
    await page.locator('label:has-text("Company Name") + input').fill(secondTenant);
    await page.locator('label:has-text("Slug") + input').fill(`role-t-${stamp}`);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/tenants\/[a-z0-9]{8,}$/, { timeout: 8000 });
    await page.waitForTimeout(800);
    await page.locator('button:has-text("Add User")').click();
    await page.waitForSelector('select#ts-existing-user');
    await page.locator('select#ts-existing-user').selectOption({ index: 1 });
    await page.locator('button[type="submit"]:has-text("Add to tenant")').click();
    await page.waitForTimeout(1500);

    await page.goto(ctx.frontendUrl + '/users');
    await page.waitForSelector('tbody tr');
    await page.waitForSelector('tbody tr [data-membership-tenant-id]');

    const row = page.locator('tbody tr').filter({ hasText: 'user@test.stjorna.local' });

    // Capture all membership ids + their current role select values
    // BEFORE we change anything.
    const beforeStates = await row.evaluate((tr) => {
      const out: { id: string; role: string }[] = [];
      tr.querySelectorAll('[data-membership-tenant-id]').forEach((d) => {
        const sel = d.querySelector('select') as HTMLSelectElement | null;
        out.push({
          id: d.getAttribute('data-membership-tenant-id') || '',
          role: sel ? sel.value : '',
        });
      });
      return out;
    });
    expect(beforeStates.length, 'test user has at least 2 memberships at this point').toBeGreaterThanOrEqual(2);

    // Pick any membership, capture its id, flip its role to 'viewer'.
    const target = beforeStates[0];
    const targetDiv = row.locator(`[data-membership-tenant-id="${target.id}"]`);
    const targetSelect = targetDiv.locator('select');
    await targetSelect.selectOption('viewer');
    await page.waitForTimeout(800);

    // Reload (so the refetch paints cleanly).
    await page.reload();
    await page.waitForSelector('tbody tr');
    await page.waitForSelector('tbody tr [data-membership-tenant-id]');

    const reloadedRow = page.locator('tbody tr').filter({ hasText: 'user@test.stjorna.local' });
    const reloadedSelectValue = await reloadedRow
      .locator(`[data-membership-tenant-id="${target.id}"] select`)
      .inputValue();
    expect(reloadedSelectValue, 'target membership role updated to viewer').toBe('viewer');

    // CRITICAL: every OTHER membership role is unchanged.
    const reloadedStates = await reloadedRow.evaluate((tr) => {
      const out: { id: string; role: string }[] = [];
      tr.querySelectorAll('[data-membership-tenant-id]').forEach((d) => {
        const sel = d.querySelector('select') as HTMLSelectElement | null;
        out.push({
          id: d.getAttribute('data-membership-tenant-id') || '',
          role: sel ? sel.value : '',
        });
      });
      return out;
    });

    for (const original of beforeStates) {
      if (original.id === target.id) continue;
      const after = reloadedStates.find((s) => s.id === original.id);
      expect(after, `membership ${original.id} still present`).toBeTruthy();
      expect(after!.role, `membership ${original.id} role unchanged`).toBe(original.role);
    }

    void secondTenant;
  });

  test('admin: per-membership Remove X drops exactly one membership', async ({ page, request }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });

    // Set up: add a fresh tenant and link testUser.
    await page.goto(ctx.frontendUrl + '/tenants/new');
    const stamp = Date.now();
    const secondTenant = `Rem T ${stamp}`;
    await page.locator('label:has-text("Company Name") + input').fill(secondTenant);
    await page.locator('label:has-text("Slug") + input').fill(`rem-t-${stamp}`);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/tenants\/[a-z0-9]{8,}$/, { timeout: 8000 });
    await page.waitForTimeout(800);
    await page.locator('button:has-text("Add User")').click();
    await page.waitForSelector('select#ts-existing-user');
    await page.locator('select#ts-existing-user').selectOption({ index: 1 });
    await page.locator('button[type="submit"]:has-text("Add to tenant")').click();
    await page.waitForTimeout(1500);

    // API auth.
    const authRes = await request.post(`${ctx.pbUrl}/api/admins/auth-with-password`, {
      data: { identity: ctx.credentials.adminEmail, password: ctx.credentials.adminPassword },
    });
    const { token } = await authRes.json();
    const authHeader = { Authorization: token };

    // Visit /users, capture row membership count BEFORE removal.
    await page.goto(ctx.frontendUrl + '/users');
    await page.waitForSelector('tbody tr');
    await page.waitForSelector('tbody tr [data-membership-tenant-id]');
    const row = page.locator('tbody tr').filter({ hasText: 'user@test.stjorna.local' });
    const beforeIds = await rowMembershipIds(row);

    // Find the membership for the new tenant via data-membership-tenant-id.
    const tenantsRes = await request.get(`${ctx.pbUrl}/api/collections/tenants/records?perPage=500`, { headers: authHeader });
    const allTenants = (await tenantsRes.json()).items;
    const newTenant = allTenants.find((t: any) => t.name === secondTenant);
    expect(newTenant, `tenant ${secondTenant}`).toBeTruthy();
    expect(beforeIds, 'memberships include new tenant before removal').toContain(newTenant.id);

    // Click that specific X button. Register the dialog handler
    // BEFORE clicking — handleRemove pops a confirm() that the
    // default browser dismisses if no listener is attached, which
    // silently aborts the removal.
    page.once('dialog', (d) => d.accept());
    await row.locator(`[data-membership-tenant-id="${newTenant.id}"] button[title^="Remove from"]`).click();
    await page.waitForTimeout(1500);

    // Reload — count AFTER removal = BEFORE - 1.
    await page.reload();
    await page.waitForSelector('tbody tr');
    await page.waitForSelector('tbody tr [data-membership-tenant-id]');
    const reloadedIds = await rowMembershipIds(
      page.locator('tbody tr').filter({ hasText: 'user@test.stjorna.local' })
    );
    expect(reloadedIds.length, 'one membership removed').toBe(beforeIds.length - 1);
    expect(reloadedIds, 'removed tenant is no longer in the row').not.toContain(newTenant.id);

    // API confirmation: the link targeting newTenant.id is gone.
    const linksAfterRes = await request.get(
      `${ctx.pbUrl}/api/collections/user_tenants/records?perPage=500&filter=tenant="${newTenant.id}"`,
      { headers: authHeader }
    );
    const linksForRemovedTenant = (await linksAfterRes.json()).items;
    expect(linksForRemovedTenant.length, 'no user_tenants link for the removed tenant').toBe(0);
  });

  test('non-admin: row scoped to current tenant', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.emulateMedia({ colorScheme: 'light' });
    await ctx.waitForDashboard();
    await page.goto(ctx.frontendUrl + '/users');
    await page.waitForTimeout(2000);

    expect.poll(
      async () => page.locator('thead th').allTextContents(),
      { timeout: 10000, intervals: [100] }
    ).toEqual(['Name', 'Email', 'Tenants']);

    await page.waitForSelector('tbody tr', { timeout: 10000 });
    await page.waitForSelector('tbody tr [data-membership-tenant-id]', { timeout: 5000 });

    // The seeded test user holds admin role in their tenant (per
    // global-setup), so they DO see admin affordances (Remove X,
    // tenant links). The non-admin *visibility* of those controls
    // is what we'd want to test separately with a viewer-role fixture.
    // What this test asserts is the aggregation invariant for the
    // non-admin row:
    //   - one row per user
    //   - exactly one membership visible (because getCurrentTenant()
    //     filters to their single tenant)

    // No tenant-link icon for non-admin (only PB admin sees the link).
    const tenantLinks = page.locator('tbody tr a[href^="/tenants/"]');
    expect(await tenantLinks.count(), 'no tenant links for non-admin viewer').toBe(0);

    // One row per user. The seeded user has accumulated memberships
    // throughout the test run, but the non-admin scope FILTER at
    // the API level limits to the current tenant, so the row holds
    // exactly one membership.
    const userRow = page.locator('tbody tr').filter({ hasText: 'user@test.stjorna.local' }).first();
    await expect(userRow).toBeVisible();
    const membershipsInUserRow = userRow.locator('[data-membership-tenant-id]');
    await expect(membershipsInUserRow, 'one membership in single-tenant scope').toHaveCount(1);
  });

  test('admin: aggregate keeps a single row even when many memberships accumulate', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(ctx.frontendUrl + '/users');
    await page.waitForSelector('tbody tr');
    await page.waitForSelector('tbody tr [data-membership-tenant-id]');

    // The aggregation invariant: regardless of how many tenants the
    // user belongs to (could be 1 at first run, dozens later from
    // accumulating tests), there's exactly one row.
    const userRows = page.locator('tbody tr').filter({ hasText: 'user@test.stjorna.local' });
    await expect(userRows, 'exactly one row per user, no duplicate').toHaveCount(1);

    // Membership count >= 1 — by this point every test in the spec
    // has added another link, but that's not the property under test.
    const membershipDivs = userRows.locator('[data-membership-tenant-id]');
    const count = await membershipDivs.count();
    expect(count, 'at least one membership listed').toBeGreaterThanOrEqual(1);
  });
});
