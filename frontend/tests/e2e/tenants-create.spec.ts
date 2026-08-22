import { test, expect, getContext } from './helpers/test-context';

/**
 * Tenant create flow on /tenants/new.
 * The route was missing — every /tenants/add hit returned a 404 because
 * params.id === 'add' and getOne('add') doesn't match any record. After
 * the fix, PB admin can open /tenants/new (or click "+ Add Tenant" in
 * the list / Quick Actions on Dashboard), fill in name+slug, hit Create
 * Tenant, and land on the freshly-created tenant's settings page.
 */
test.describe('Tenant create flow', () => {
  test('Tenants list page has + Add Tenant button (was missing)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(ctx.frontendUrl + '/tenants');
    await page.waitForSelector('h1:has-text("Tenants")');

    const btn = page.locator('a[href="/tenants/new"]:has-text("+ Add Tenant")');
    await expect(btn).toBeVisible();

    // Same styling as the rest of the "+ Add" buttons across the app:
    // tenant = orange-600 (ENTITY_TYPE_BUTTON_CLASSES in styles/colors).
    const info = await btn.evaluate(el => ({
      bg: getComputedStyle(el).backgroundColor,
      color: getComputedStyle(el).color,
    }));
    expect(info.bg).toBe('rgb(234, 88, 12)');   // orange-600
    expect(info.color).toBe('rgb(255, 255, 255)'); // white text on orange
  });

  test('Dashboard Quick Actions: + Add Tenant links to /tenants/new (was /tenants/add which 404\'d)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(ctx.frontendUrl + '/');

    const btn = page.locator('a[href="/tenants/new"]:has-text("+ Add Tenant")');
    await expect(btn).toBeVisible();

    // Make sure no /tenants/add remnants linger anywhere in the dashboard.
    const staleAdd = await page.locator('a[href="/tenants/add"]').count();
    expect(staleAdd).toBe(0);
  });

  test('Admin can create tenant from /tenants/new', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto(ctx.frontendUrl + '/tenants/new');

    // Title + button text reflect create mode (was showing "Tenant Settings" before).
    await expect(page.locator('h1:has-text("New Tenant")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button[type="submit"]:has-text("Create Tenant")')).toBeVisible();

    // "Tenant not found." was the symptom of the original bug — must NOT appear.
    await expect(page.locator('text="Tenant not found."')).toHaveCount(0);

    // Modal sections that need an existing tenant id are hidden in create mode.
    await expect(page.locator('text=/Backup/i')).toHaveCount(0);
    await expect(page.locator('text=/Tenant Users/i')).toHaveCount(0);

    // Fill and submit.
    const stamp = Date.now();
    const name = `E2E T ${stamp}`;
    const slug = `e2e-t-${stamp}`;
    await page.locator('label:has-text("Company Name") + input').fill(name);
    await page.locator('label:has-text("Slug") + input').fill(slug);
    await page.locator('button[type="submit"]:has-text("Create Tenant")').click();

    // Lands on the freshly-created tenant's settings page (replace=true).
    // PB ids are 15-char nanoids; '/tenants/new' (3 chars) should NOT match.
    await page.waitForURL(/\/tenants\/[a-z0-9]{8,}$/, { timeout: 8000 });
    const landedAt = page.url();
    expect(landedAt).not.toMatch(/\/new$/);

    // The previous title "Tenant Settings" now confirms we're on edit, not new.
    await expect(page.locator('h1:has-text("Tenant Settings")')).toBeVisible();

    // Form was hydrated with the persisted values (round-trip through PB).
    await expect(page.locator('label:has-text("Company Name") + input')).toHaveValue(name);
    await expect(page.locator('label:has-text("Slug") + input')).toHaveValue(slug);

    // Backup + User sections are now showing because we have a real id.
    await expect(page.locator('text=/Backup/i').first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=/Tenant Users/i').first()).toBeVisible({ timeout: 3000 });
  });

  test('Created tenant appears in /tenants list', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });

    // Create via the new form.
    await page.goto(ctx.frontendUrl + '/tenants/new');
    const stamp = Date.now();
    const name = `List T ${stamp}`;
    const slug = `list-t-${stamp}`;
    await page.locator('label:has-text("Company Name") + input').fill(name);
    await page.locator('label:has-text("Slug") + input').fill(slug);
    await page.locator('button[type="submit"]:has-text("Create Tenant")').click();
    await page.waitForURL(/\/tenants\/[a-z0-9]{8,}$/, { timeout: 8000 });

    // Visit list and verify row exists.
    await page.goto(ctx.frontendUrl + '/tenants');
    await expect(page.locator(`td:has-text("${name}")`).first()).toBeVisible({ timeout: 5000 });
  });

  test('Existing tenant settings page still works (regression for /tenants/:id)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });

    // Get the first tenant id from the list — that's a real, existing record.
    await page.goto(ctx.frontendUrl + '/tenants');
    await page.waitForSelector('tbody tr');
    const firstRow = page.locator('tbody tr').first();
    await firstRow.locator('button:has-text("Settings")').click();
    await page.waitForURL(/\/tenants\/[a-z0-9]{8,}$/, { timeout: 5000 });

    // Edit page hydrates from PB, NOT create mode.
    await expect(page.locator('h1:has-text("Tenant Settings")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button[type="submit"]:has-text("Save Settings")')).toBeVisible();
    await expect(page.locator('text="Tenant not found."')).toHaveCount(0);
    // Edit mode shows Backup + Tenant Users sections.
    await expect(page.locator('text=/Tenant Users/i').first()).toBeVisible({ timeout: 3000 });
  });
});
