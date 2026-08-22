import { test, expect, getContext } from './helpers/test-context';

/**
 * Covers the admin-only Tenant column on the /activities page.
 * Lets a PB admin see "where" each activity happened — which
 * tenant — without leaving the page. Non-admin viewers (single-tenant
 * users) don't get the column; for them the column would be redundant
 * noise.
 *
 * Why expect.poll: on mount authStore.isPBAdmin is still false (the
 * initial value before authStore.init() resolves admin status and
 * flips it). The createMemo in Activities() is reactive, so once
 * init() runs the column is added — but that happens AFTER the first
 * mount render. `expect.poll` retries until the assertion holds,
 * which is the right shape for an order-dependent DOM state.
 */
test.describe('Activities tenant column (admin only)', () => {
  test('admin sees Tenant column with resolved names and clickable links', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(ctx.frontendUrl + '/activities');

    // Wait for the data table to come back after the post-init re-render.
    await expect.poll(
      async () => page.locator('thead th').allTextContents(),
      { timeout: 10000, intervals: [100] }
    ).toEqual(['Type', 'Action', 'Name', 'Tenant', 'Record', 'When']);
    await page.waitForFunction(
      () => document.querySelectorAll('tbody tr').length > 0,
      null,
      { timeout: 10000 }
    );

    // 2. Every row's Tenant cell is either a /tenants/<id> link or a "—" placeholder.
    // User-type events have no tenant scope so they fall back to "—".
    const cells = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      return rows.map((row) => {
        const tds = Array.from(row.querySelectorAll('td'));
        const tenantTd = tds[3]; // Type, Action, Name, Tenant
        if (!tenantTd) return null;
        const link = tenantTd.querySelector('a[href^="/tenants/"]');
        const text = (tenantTd.textContent || '').trim();
        return { link: link ? (link as HTMLAnchorElement).getAttribute('href') : null, text };
      });
    });

    expect(cells.length).toBeGreaterThan(0);
    const linkCells = cells.filter((c) => c && c.link);
    const dashCells  = cells.filter((c) => c && !c.link);
    expect(linkCells.length).toBeGreaterThan(0);

    // All seeded events share one tenant in the e2e setup.
    const hrefs = new Set(linkCells.map((c) => c!.link));
    expect(hrefs.size).toBe(1);
    for (const href of hrefs) {
      expect(href).toMatch(/^\/tenants\/[a-z0-9]+$/);
    }

    // Resolved names are not raw tenant IDs — admin should see "Test Company".
    for (const c of linkCells) {
      expect(c!.text).toBe('Test Company');
    }

    // Tenant-type events resolve to the same name (the entity IS the tenant).
    const tenantTypeText = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      for (const row of rows) {
        const tds = Array.from(row.querySelectorAll('td'));
        if ((tds[0]?.textContent || '').trim() === 'Tenant') {
          const tenantTd = tds[3];
          return tenantTd ? (tenantTd.textContent || '').trim() : null;
        }
      }
      return null;
    });
    expect(tenantTypeText).toBe('Test Company');

    // User-type events show "—" because users sit outside tenant scope.
    const userTypeText = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'));
      for (const row of rows) {
        const tds = Array.from(row.querySelectorAll('td'));
        if ((tds[0]?.textContent || '').trim() === 'User') {
          const tenantTd = tds[3];
          return tenantTd ? (tenantTd.textContent || '').trim() : null;
        }
      }
      return null;
    });
    expect(userTypeText).toBe('—');

    void dashCells;
  });

  test('non-admin does NOT see Tenant column (column count = 5)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(ctx.frontendUrl + '/activities');

    await expect.poll(
      async () => page.locator('thead th').allTextContents(),
      { timeout: 10000, intervals: [100] }
    ).toEqual(['Type', 'Action', 'Name', 'Record', 'When']);
    await page.waitForFunction(
      () => document.querySelectorAll('tbody tr').length > 0,
      null,
      { timeout: 10000 }
    );

    // No /tenants/ links anywhere in tbody — only admins get that.
    const tenantLinks = await page.locator('tbody a[href^="/tenants/"]').count();
    expect(tenantLinks).toBe(0);
  });

  test('dark mode: tenant column link uses blue-400 (readable on dark bg)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto(ctx.frontendUrl + '/activities');

    await expect.poll(
      async () => page.locator('tbody tr td a[href^="/tenants/"]').count(),
      { timeout: 10000, intervals: [100] }
    ).toBeGreaterThan(0);

    const link = page.locator('tbody tr td a[href^="/tenants/"]').first();
    const color = await link.evaluate(el => getComputedStyle(el).color);
    expect(color).toBe('rgb(96, 165, 250)'); // blue-400 = #60a5fa
  });
});
