import { test, expect, getContext } from './helpers/test-context';

/**
 * TenantSettings "Add User" must be a dropdown of EXISTING users,
 * not a create-user form. New user creation is owned by UserManagement
 * (/users → + Invite User). The tenant panel only manages the *link*
 * between users and tenants — i.e. creates `user_tenants` records.
 *
 * What this locks in:
 *  - No email/password/name inputs inside the Add User form
 *    (those would create a NEW user record, which is the wrong
 *     responsibility for this page).
 *  - Existing users are listed in a dropdown, with the
 *    <option value="">— Select a user —</option> placeholder.
 *  - Submitting creates only the user_tenants link — no
 *    secondary draft user record is created on the users collection.
 *  - After assigning, the user disappears from the dropdown.
 *  - Empty-state hint ("No users available") links to /users when
 *    every user is already linked to this tenant.
 *  - /users page still has its own + Invite User button — the
 *    create-user surface wasn't accidentally removed.
 */
test.describe('TenantSettings — Add User is a dropdown, not a create form', () => {
  test('Add User form has NO email/password inputs (regression for create-form removal)', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });

    await page.goto(ctx.frontendUrl + '/tenants');
    await page.waitForSelector('tbody tr');
    // Use the first tenant that has zero users so we can drive the full flow
    // — but for this regression test we only need to open any tenant and
    // inspect the Add User panel for the cut fields.
    await page.locator('tbody tr').first().locator('button:has-text("Settings")').click();
    await page.waitForURL(/\/tenants\/[a-z0-9]{8,}$/, { timeout: 8000 });

    await page.locator('button:has-text("Add User")').click();
    await page.waitForSelector('select#ts-existing-user');

    // CRITICAL: the create-user form must not be reachable from here.
    const emailInForm    = await page.locator('form input[type="email"]').count();
    const passwordInForm = await page.locator('form input[type="password"]').count();
    expect(emailInForm, 'email input inside Add User form').toBe(0);
    expect(passwordInForm, 'password input inside Add User form').toBe(0);

    // CRITICAL: the dropdown is present.
    await expect(page.locator('select#ts-existing-user')).toBeVisible();
    await expect(page.locator('select#ts-existing-role')).toBeVisible();
  });

  test('Dropdown lists existing users with email', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });

    // Pick the first tenant. Use the seed tenant so we know the exact
    // list of users; the seeded regular user 'user@test.stjorna.local'
    // is in testTenant — which means it should NOT show up in the
    // dropdown here (already linked). Add a fresh tenant first so we
    // can observe the full set of available users.
    await page.goto(ctx.frontendUrl + '/tenants/new');
    const stamp = Date.now();
    await page.locator('label:has-text("Company Name") + input').fill('Assign T ' + stamp);
    await page.locator('label:has-text("Slug") + input').fill('assign-t-' + stamp);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/tenants\/[a-z0-9]{8,}$/, { timeout: 8000 });
    await page.waitForTimeout(800);

    await page.locator('button:has-text("Add User")').click();
    await page.waitForSelector('select#ts-existing-user');

    const dropdown = page.locator('select#ts-existing-user');
    const allOpts = await dropdown.locator('option').allTextContents();
    // Placeholder disabled option is always present.
    expect(allOpts[0]).toContain('Select a user');
    // The seeded regular user is NOT in testTenant, so they ARE available.
    // Their label is "Test User <user@test.stjorna.local>".
    const hasSeededUser = allOpts.some((t) => t.includes('user@test.stjorna.local'));
    expect(hasSeededUser, `dropdown options: ${JSON.stringify(allOpts)}`).toBe(true);
  });

  test('Submit creates ONLY a user_tenants link (no new users record)', async ({ page, request }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });

    // Authenticate as admin against the PB API so we can verify
    // collection counts before/after without depending on the worker
    // process having access to a shared PocketBase client.
    const authRes = await request.post(`${ctx.pbUrl}/api/admins/auth-with-password`, {
      data: { identity: ctx.credentials.adminEmail, password: ctx.credentials.adminPassword },
    });
    const { token } = await authRes.json();
    const authHeader = { Authorization: token };

    const usersBeforeRes = await request.get(`${ctx.pbUrl}/api/collections/users/records?perPage=500`, { headers: authHeader });
    const usersBefore = (await usersBeforeRes.json()).items;
    const linksBeforeRes = await request.get(`${ctx.pbUrl}/api/collections/user_tenants/records?perPage=500`, { headers: authHeader });
    const linksBefore = (await linksBeforeRes.json()).items;

    await page.goto(ctx.frontendUrl + '/tenants/new');
    const stamp = Date.now();
    const tName = 'Link T ' + stamp;
    await page.locator('label:has-text("Company Name") + input').fill(tName);
    await page.locator('label:has-text("Slug") + input').fill('link-t-' + stamp);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/tenants\/[a-z0-9]{8,}$/, { timeout: 8000 });
    await page.waitForTimeout(800);

    await page.locator('button:has-text("Add User")').click();
    await page.waitForSelector('select#ts-existing-user');

    await page.locator('select#ts-existing-user').selectOption({ index: 1 });
    await page.locator('select#ts-existing-role').selectOption('editor');
    await page.locator('button[type="submit"]:has-text("Add to tenant")').click();
    await page.waitForTimeout(1500);

    // After submit: NO new users on the users collection (this is the
    // whole point — adding to a tenant must not provision user accounts).
    const usersAfterRes = await request.get(`${ctx.pbUrl}/api/collections/users/records?perPage=500`, { headers: authHeader });
    const usersAfter = (await usersAfterRes.json()).items;
    expect(usersAfter.length, 'users count after').toBe(usersBefore.length);

    // …BUT exactly one new user_tenants link was created for the
    // freshly-created tenant.
    const linksAfterRes = await request.get(`${ctx.pbUrl}/api/collections/user_tenants/records?perPage=500`, { headers: authHeader });
    const linksAfter = (await linksAfterRes.json()).items;
    expect(linksAfter.length, 'user_tenants link count after').toBe(linksBefore.length + 1);

    const tenantsRes = await request.get(`${ctx.pbUrl}/api/collections/tenants/records?perPage=500`, { headers: authHeader });
    const allTenants = (await tenantsRes.json()).items;
    const newTenant = allTenants.find((t: any) => t.name === tName);
    expect(newTenant, `tenant ${tName} exists`).toBeTruthy();

    const newLinks = linksAfter.filter((l: any) => l.tenant === newTenant.id);
    expect(newLinks.length, `user_tenants links for new tenant`).toBe(1);
  });

  test('Assigned user disappears from the dropdown', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });

    await page.goto(ctx.frontendUrl + '/tenants/new');
    const stamp = Date.now();
    await page.locator('label:has-text("Company Name") + input').fill('After T ' + stamp);
    await page.locator('label:has-text("Slug") + input').fill('after-t-' + stamp);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/tenants\/[a-z0-9]{8,}$/, { timeout: 8000 });
    await page.waitForTimeout(800);

    await page.locator('button:has-text("Add User")').click();
    await page.waitForSelector('select#ts-existing-user');

    const before = await page.locator('select#ts-existing-user option:not([disabled])').count();
    expect(before).toBeGreaterThan(0);

    await page.locator('select#ts-existing-user').selectOption({ index: 1 });
    await page.locator('button[type="submit"]:has-text("Add to tenant")').click();
    await page.waitForTimeout(1500);

    // Re-open the panel — the assigned user must be gone.
    await page.locator('button:has-text("Add User")').click();
    await page.waitForSelector('select#ts-existing-user');
    const after = await page.locator('select#ts-existing-user option:not([disabled])').count();
    expect(after).toBe(before - 1);

    // And the assigned user is now in the rendered tenant users list.
    await page.locator('button:has-text("Cancel")').click();
    await page.waitForTimeout(300);
    await expect(page.locator('text="Test User"').first()).toBeVisible();
    await expect(page.locator('text="user@test.stjorna.local"').first()).toBeVisible();
  });

  test('Empty-state hint + link to /users when every user is already linked', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });

    // Build a fresh tenant.
    await page.goto(ctx.frontendUrl + '/tenants/new');
    const stamp = Date.now();
    await page.locator('label:has-text("Company Name") + input').fill('Empty T ' + stamp);
    await page.locator('label:has-text("Slug") + input').fill('empty-t-' + stamp);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL(/\/tenants\/[a-z0-9]{8,}$/, { timeout: 8000 });
    await page.waitForTimeout(800);

    // Assign the only available user.
    await page.locator('button:has-text("Add User")').click();
    await page.waitForSelector('select#ts-existing-user');
    const before = await page.locator('select#ts-existing-user option:not([disabled])').count();
    expect(before).toBe(1);
    await page.locator('select#ts-existing-user').selectOption({ index: 1 });
    await page.locator('button[type="submit"]:has-text("Add to tenant")').click();
    await page.waitForTimeout(1500);

    // Re-open.
    await page.locator('button:has-text("Add User")').click();
    await page.waitForSelector('select#ts-existing-user');

    // Now empty — the hint must show with a link to /users.
    const after = await page.locator('select#ts-existing-user option:not([disabled])').count();
    expect(after).toBe(0);
    const hint = page.locator('text=/No users available/');
    await expect(hint).toBeVisible();
    const link = page.locator('a[href="/users"]:has-text("User Management")');
    await expect(link).toBeVisible();

    // Submit is also disabled while there are no candidates.
    const addBtn = page.locator('button[type="submit"]:has-text("Add to tenant")');
    await expect(addBtn).toBeDisabled();
  });

  test('UserManagement (/users) still owns the create-user surface', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();
    await page.emulateMedia({ colorScheme: 'light' });

    await page.goto(ctx.frontendUrl + '/users');
    await page.waitForSelector('h1:has-text("User Management")');

    // Must still have a + Invite User button.
    const inviteBtn = page.locator('button:has-text("Invite User")');
    await expect(inviteBtn).toBeVisible();

    // Click and verify the create form is reachable from /users.
    await inviteBtn.click();
    await page.waitForSelector('h2:has-text("Invite User")');
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
    await expect(page.locator('input[type="email"]').first()).toHaveAttribute('required');
  });
});
