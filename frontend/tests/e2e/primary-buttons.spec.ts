import { test, expect, getContext } from './helpers/test-context';

test.describe('Primary button styling (regression for class-template-literal bug)', () => {
  let ctx: ReturnType<typeof getContext>;

  test.beforeEach(async ({ page }) => {
    ctx = getContext(page);
    await ctx.loginAsUser();
    await ctx.waitForDashboard();
  });

  // Save buttons on edit forms used to ship as `class="${TOKEN} ..."` (plain
  // string) instead of `class={`${TOKEN} ...`}` (template literal). The
  // literal `${...}` made it into the DOM as text and Tailwind applied
  // nothing — the buttons rendered as ghost buttons. This test pins the
  // class list and the computed background colour so we catch a
  // regression of that exact mistake.

  test('Save buttons render with bg-blue-600 applied', async ({ page }) => {
    const probe = async (path: string, buttonText: string) => {
      await page.goto(ctx.frontendUrl + path);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(300);
      const btn = page.locator(`button:has-text("${buttonText}")`).first();
      await expect(btn, `${path} → "${buttonText}"`).toHaveClass(/\bbg-blue-600\b/);
      await expect(btn, `${path} → "${buttonText}"`).toHaveClass(/\bhover:bg-blue-700\b/);
      // Computed bg should be rgb(37, 99, 235) (Tailwind blue-600).
      const bg = await btn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
      expect(bg, `${path} → "${buttonText}" computed background`).toBe('rgb(37, 99, 235)');
    };

    await probe('/categories/new', 'Save Category');
    await probe('/products/new', 'Save Product');
    await probe('/media/new', 'Upload');
  });

  test('Settings save button renders with primary bg', async ({ page }) => {
    await page.goto(ctx.frontendUrl + '/settings');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(300);
    const btn = page.locator('button[type="submit"]').first();
    await expect(btn).toHaveClass(/\bbg-blue-600\b/);
    const bg = await btn.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    expect(bg).toBe('rgb(37, 99, 235)');
  });
});