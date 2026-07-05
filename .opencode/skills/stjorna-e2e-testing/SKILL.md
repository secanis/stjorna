---
name: stjorna-e2e-testing
description: Provides Playwright E2E testing guidance for STJÓRNA. Use when writing tests, debugging test failures, or implementing test-driven development for STJÓRNA features.
---

# STJÓRNA E2E Testing Skill

## Test Infrastructure Overview

Tests live in `tests/e2e/` and use Playwright with a fresh Podman container per test run (no volumes = clean state).

```
tests/e2e/
├── helpers/
│   ├── global-setup.ts      # Starts/stops Podman container, creates collections
│   ├── global-teardown.ts   # Stops Podman container
│   ├── test-context.ts      # Test fixtures, login helpers, Page wrapper
│   └── page-objects.ts      # (optional) reusable page object helpers
├── auth.spec.ts             # Login/logout flows, PB admin vs user detection
├── dashboard.spec.ts        # Dashboard stats, recent activity, PB admin vs user views
├── sidebar.spec.ts          # Nav items, count pills, active state
├── categories.spec.ts       # Category CRUD, toggle active
├── media.spec.ts            # Media list, upload, delete
├── settings.spec.ts         # Tenant settings, instance settings
└── tenants.spec.ts          # Tenant management (PB admin only)
```

## Running Tests

```bash
# Full run: build frontend then run tests (use after code changes)
npm run test:e2e

# Fast run: just run tests (frontend dist already up-to-date)
npm run test:e2e:fast

# With UI (headed mode)
npx playwright test --headed

# Single file
npx playwright test tests/e2e/auth.spec.ts

# With trace viewer (on failure)
npx playwright test --trace=on-first-retry
```

## Key Test Patterns

### TestContext helper
All tests use `TestContext` which wraps Playwright's `Page` with STJÓRNA-specific helpers:

```typescript
import { test, expect } from './helpers/test-context';

// Use the context fixture
test('PB admin login', async ({ context }) => {
  await context.loginAsAdmin();
  await context.waitForDashboard();
  // context.page is the raw Playwright Page
  await expect(context.page.locator('h1')).toContainText('Dashboard');
});
```

### Login helpers
```typescript
await context.loginAsAdmin();   // Uses PB admin credentials + mode=admin
await context.loginAsUser();    // Uses regular user credentials + mode=user
```

### Credentials available
```typescript
context.credentials.adminEmail      // admin@test.stjorna.local
context.credentials.adminPassword   // admin12345678test
context.credentials.userEmail       // user@test.stjorna.local
context.credentials.userPassword    // user12345678test
context.pbUrl                       // http://localhost:8090
context.frontendUrl                 // http://localhost:4173
context.tenantId                    // ID of test tenant (set by global-setup)
```

### Podman container management
Global setup (`global-setup.ts`) starts a **fresh** container without any volume each time tests run:
- Starts `localhost/stjorna-pocketbase:test` with `--rm --network=host`
- Creates admin account: `admin@test.stjorna.local` / `admin12345678test`
- Creates collections: tenants, categories, products, media, user_tenants, instance_settings
- Creates test tenant: "Test Company" (slug: test-company)
- Creates regular user: `user@test.stjorna.local` / `user12345678test`, linked to test tenant as admin
- Sets `instance_settings.setup_done = true`
- Adds `last_tenant` field to users collection

### Test data reset
Each test run gets a **completely fresh** PocketBase instance. Collections are pre-seeded with:
- 1 category: "Test Category"
- 1 media item: "test-image.jpg"
- 1 tenant: "Test Company"
- 1 regular user linked to tenant as admin

## Writing New Tests

### Rule of thumb: write test FIRST, then implement
When adding a new feature:
1. Write the Playwright test describing expected behavior
2. Run `npm run test:e2e` — test fails (feature doesn't exist yet)
3. Implement the feature
4. Run tests again — test passes
5. This ensures every feature has automated verification

### Test structure template
```typescript
import { test, expect } from './helpers/test-context';

test.describe('Feature Area', () => {
  test.beforeEach(async ({ context }) => {
    // Common setup for all tests in this file
    await context.loginAsAdmin();
    await context.page.goto(context.frontendUrl + '/relevant-path');
    await context.page.waitForSelector('h1:has-text("Page Title")');
  });

  test('user can perform action X', async ({ context }) => {
    await context.page.getByRole('button', { name: 'Action X' }).click();
    await expect(context.page.locator('.success-message')).toBeVisible();
  });

  test('action X fails with invalid input', async ({ context }) => {
    await context.page.getByLabel('Input').fill('');
    await context.page.getByRole('button', { name: 'Submit' }).click();
    await expect(context.page.locator('.error')).toContainText('required');
  });
});
```

### Selector best practices
```typescript
// Prefer semantic selectors over CSS classes
context.page.getByRole('button', { name: 'Submit' })
context.page.getByLabel('Email')
context.page.getByText('Category Name')

// For table rows, use data-testid or text content
context.page.locator('tbody tr:has-text("Test Category")')

// Avoid brittle selectors
context.page.locator('.bg-blue-600')  // fragile - use role instead
```

### Waiting for navigation/updates
```typescript
// Wait for URL change
await context.page.waitForURL('**/categories');

// Wait for element to appear
await context.page.waitForSelector('h1:has-text("Categories")');

// Wait for network idle (after form submission)
await context.page.waitForLoadState('networkidle');

// Don't use arbitrary sleep - use waitForSelector or waitForURL
await context.page.waitForTimeout(1000);  // only when necessary
```

## Test Debugging

### Check what's in the Podman container
```bash
# Manual inspection
podman ps
podman logs <container-id>

# Check collections via API
curl http://localhost:8090/api/collections/tenants/records
```

### Common issues
1. **Test fails because collections don't exist** → Global setup failed. Check `global-setup.ts` logs in test output
2. **Tests pass in headed mode but fail in headless** → Timing issue. Add `waitForLoadState('networkidle')` after interactions
3. **`setup_done` redirect** → Tests run after global setup sets `setup_done = true`, so `/setup` redirects. This is correct behavior
4. **Stale frontend dist** → Run `npm run test:e2e` (full build) instead of `test:e2e:fast`
5. **"New Category" shows as "Edit Category"** → Router matches `/categories/add` as `/categories/:id` with id="add". Component must handle both 'new' and 'add' as special values

## Route Patterns for "New Item" Routes

STJÓRNA uses `/resource/add` (not `/resource/new`) for new item creation routes. This is due to @solidjs/router potentially matching parameterized routes before static routes.

### Current new-item routes
```typescript
// App.tsx route definitions
<Route path="/media/new" component={MediaEdit} />
<Route path="/categories/add" component={CategoryEdit} />
<Route path="/categories/:id" component={CategoryEdit} />
```

### Handling special IDs in edit forms
When the router matches a parameterized route, the `params.id` may be "add" or "new" instead of an actual record ID. The edit form component must handle this:

```typescript
// CategoryEdit.tsx example
const isNewCategory = params.id === 'new' || params.id === 'add';

if (params.id && !isNewCategory) {
  // Fetch existing record for edit
  const category = await pb.collection('categories').getOne(params.id);
  // ...
}

// In heading:
{(!params.id || params.id === 'new' || params.id === 'add') ? 'New Category' : 'Edit Category'}
```

## PB Admin Role Checks

PB admin users (who log in via `/login?mode=admin`) do NOT have a `role` field set in the auth store because they authenticate via PocketBase admin credentials, not user credentials. Role checks like `isEditorOrAbove()` must explicitly check for PB admin:

```typescript
// auth.ts - WRONG (PB admin gets false)
isEditorOrAbove: createMemo(() => {
  const r = role();
  return r === 'editor' || r === 'admin';
}),

// auth.ts - CORRECT
isEditorOrAbove: createMemo(() => {
  if (isPBAdmin()) return true;  // PB admin always has editor permissions
  const r = role();
  return r === 'editor' || r === 'admin';
}),
```

## Known Limitations

### PB admin tenant query in create forms
PB admin users logging in via admin auth (`pb.admins.authWithPassword`) have `pb.authStore.isAdmin = true` but their auth token does NOT grant them direct access to tenant collection records via normal API calls. The `tenants` collection listRule is:
```
'@request.auth.user_tenants.tenant.id = tenant.id'
```
This requires a `user_tenants` relation, which PB admin users don't have. As a result, create forms that need to auto-select a tenant for PB admin will fail the tenant fallback query. This is a design limitation - the tenant fallback query needs a different approach (e.g., using the test tenant ID from global-setup context).

### Setup redirect test
The test for `/setup` redirect when `setup_done=true` requires setting both `stjorna_pb_url` and `pb_setup_done` in localStorage, and the redirect check in Setup.tsx fetches from PocketBase (requires auth). This test is currently skipped.

### Route matching with parameterized routes
@solidjs/router may match parameterized routes (`:id`) before static routes if the static route isn't defined first. Always define static routes before parameterized routes in App.tsx, and handle both 'new' and 'add' as special ID values in edit form components.

## Adding a New Test File

1. Create `tests/e2e/new-feature.spec.ts`
2. Import from `./helpers/test-context`
3. Add tests following the patterns above
4. Run: `npx playwright test tests/e2e/new-feature.spec.ts`

## Frontend Changes Between Test Runs

`npm run test:e2e` runs `npm run build --prefix frontend` first, ensuring the latest code is tested. Use `npm run test:e2e:fast` during development when you know the build is current.

## Playwright Config Notes

- `workers: 1` — Podman container is shared state, run tests sequentially
- `fullyParallel: false` — Same reason
- `globalSetup` starts the container; `globalTeardown` stops it
- `webServer` starts `npm run preview` in `frontend/` dir on port 4173
- `baseURL: http://localhost:4173` — all `context.page.goto()` calls use this as base