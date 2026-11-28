import { test, expect, getContext } from './helpers/test-context';

test.describe('Developers page', () => {
    test('renders the integration guide', async ({ page }) => {
        const ctx = getContext(page);
        await ctx.loginAsUser();
        await page.goto(ctx.frontendUrl + '/developers');

        await expect(page.locator('h1:has-text("Developers")')).toBeVisible({ timeout: 10000 });

        // Both flows are present: the storefront heading + the public embed URL.
        await expect(page.getByText('Storefront (full catalog)')).toBeVisible();
        await expect(page.getByText('/api/stjorna/media/', { exact: false })).toBeVisible();
    });

    test('Developers sidebar link is visible to editor+', async ({ page }) => {
        const ctx = getContext(page);
        await ctx.loginAsUser();
        await page.waitForSelector('aside');
        const link = page.locator('aside a[href="/developers"]');
        await expect(link).toBeVisible();
    });
});
