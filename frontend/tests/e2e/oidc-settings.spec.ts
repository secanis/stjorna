import { test, expect, getContext } from './helpers/test-context';

test.describe('OIDC settings page', () => {
  test('admin can open OIDC settings and sees defaults', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsAdmin();

    await page.goto(ctx.frontendUrl + '/settings/oidc');
    await expect(page.getByRole('heading', { name: 'OIDC Settings' })).toBeVisible();

    // Form should load with sensible defaults.
    await expect(page.locator('label:has-text("Provider slot") + input')).toHaveValue('oidc');
    await expect(page.locator('label:has-text("Groups claim") + input')).toHaveValue('groups');
    await expect(page.locator('label:has-text("Separator") + input')).toHaveValue('_');

    // Redirect URL is shown so admins can copy it into their OIDC client.
    await expect(page.getByText('/api/oauth2-redirect')).toBeVisible();

    // Toggle states on a fresh instance.
    await expect(page.locator('label:has-text("Enable OIDC login") input[type="checkbox"]')).not.toBeChecked();
    await expect(page.locator('label:has-text("Disable regular user password login") input[type="checkbox"]')).not.toBeChecked();
  });

  test('non-admin user is redirected away from OIDC settings', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();

    await page.goto(ctx.frontendUrl + '/settings/oidc');
    await page.waitForURL('**/');
  });
});
