import { test, expect, getContext } from './helpers/test-context';

test.describe('Activities', () => {
  let ctx: ReturnType<typeof getContext>;

  test.beforeEach(async ({ page }) => {
    ctx = getContext(page);
    await ctx.loginAsUser();
    await ctx.waitForDashboard();
  });

  test('activities page loads with sidebar entry', async ({ page }) => {
    // Sidebar should show the Activities link
    const sidebarLink = page.locator('aside a[href="/activities"]');
    await expect(sidebarLink).toBeVisible({ timeout: 10000 });

    await page.goto(ctx.frontendUrl + '/activities');
    await expect(page.locator('h1:has-text("Activities")')).toBeVisible({ timeout: 10000 });
    // Filters block
    await expect(page.locator('text=Type').first()).toBeVisible();
    await expect(page.locator('text=Action').first()).toBeVisible();
    // Header columns
    await expect(page.locator('th:has-text("When")')).toBeVisible();
  });

  test('type filter narrows results', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/activities');
    await expect(page.locator('h1:has-text("Activities")')).toBeVisible({ timeout: 10000 });
    // Wait for at least one event to render
    await page.waitForSelector('tbody tr', { timeout: 10000 });

    const before = await page.locator('tbody tr').count();
    expect(before).toBeGreaterThan(0);

    // Filter to Category — the e2e setup seeds one category record.
    await page.locator('button:has-text("Category")').first().click();
    // Allow the resource to refetch
    await page.waitForTimeout(500);

    // Every visible row should now have a "Category" type badge
    const badges = await page.locator('tbody tr span:has-text("Category")').count();
    const rows = await page.locator('tbody tr').count();
    expect(rows).toBeGreaterThan(0);
    expect(badges).toBe(rows);
  });

  test('name filter hides non-matching rows', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/activities');
    await expect(page.locator('h1:has-text("Activities")')).toBeVisible({ timeout: 10000 });
    await page.waitForSelector('tbody tr', { timeout: 10000 });

    await page.locator('#act-search').fill('zzz-no-match-string');
    await page.waitForTimeout(300);

    await expect(page.locator('text=No events match the name filter.')).toBeVisible();
  });

  test('reset filters clears the form', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/activities');
    await expect(page.locator('h1:has-text("Activities")')).toBeVisible({ timeout: 10000 });

    await page.locator('button:has-text("Product")').first().click();
    await page.locator('#act-search').fill('foo');
    await expect(page.locator('button:has-text("Product")').first()).toHaveClass(/bg-emerald-600/);

    await page.locator('button:has-text("Reset")').click();
    await expect(page.locator('#act-search')).toHaveValue('');
    await expect(page.locator('button:has-text("Product")').first()).not.toHaveClass(/bg-emerald-600/);
  });
});