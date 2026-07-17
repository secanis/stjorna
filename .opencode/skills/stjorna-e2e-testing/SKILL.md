---
name: stjorna-e2e-testing
description: Provides Playwright E2E testing guidance for STJÓRNA. Use when writing tests, debugging test failures, or implementing test-driven development for STJÓRNA features. Covers schema, fixtures, container setup, common gotchas, and OpenAPI/Swagger UI testing.
---

# STJÓRNA E2E Testing Skill

## Test Infrastructure Overview

Tests live in `tests/e2e/` and use Playwright with a fresh Podman container per test run (no volumes = clean state). Frontend is built and served via Vite preview on port 4173.

```
tests/e2e/
├── helpers/
│   ├── global-setup.ts        # Starts/stops Podman, creates collections, seed data
│   ├── global-teardown.ts     # Stops Podman container
│   ├── test-context.ts        # TestContext (page wrapper + login helpers)
│   └── (no page-objects.ts yet)
├── auth.spec.ts               # Login/logout flows, admin vs user detection
├── sidebar.spec.ts            # Nav items, count pills, active state
├── categories.spec.ts         # Category CRUD, slug, active toggle
├── products.spec.ts           # Product CRUD, media picker, drag-drop reorder
├── media.spec.ts              # Media list, upload (real PNG), delete, S3 test
├── api-rules.spec.ts          # API rules enforcement
├── setup-storage.spec.ts      # Setup wizard storage step (S3 config)
└── api-docs.spec.ts           # OpenAPI spec endpoint + Swagger UI render
```

## Running Tests

```bash
# Full run: build frontend + run tests (use after code changes)
npm run test:e2e

# Fast run: skip rebuild (frontend dist already up-to-date)
npm run test:e2e:fast

# Headed mode
npx playwright test --headed

# Single file
npx playwright test tests/e2e/api-docs.spec.ts

# With trace viewer on failure
npx playwright test --trace=on-first-retry

# Filter by test name
npx playwright test -g "GET /api/openapi.json"
```

## Playwright Config (`playwright.config.ts`)

```typescript
{
  testDir: './tests/e2e',
  fullyParallel: false,    // PB container is shared state
  workers: 1,              // sequential
  baseURL: 'http://localhost:4173',  // Vite preview, not Vite dev
  webServer: {
    command: 'npm run preview',
    cwd: './frontend',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
  },
  globalSetup: './tests/e2e/helpers/global-setup',
  globalTeardown: './tests/e2e/helpers/global-teardown',
}
```

**Important:** Tests use `npm run preview` (built static SPA on :4173), NOT Vite dev server (:3000). For local dev with hot reload, run `npm run dev` separately on :3000 and use port :3000 manually.

## Key Test Patterns

### TestContext helper

All tests use `TestContext` which wraps Playwright's `Page` with STJÓRNA-specific helpers. Imported from `./helpers/test-context`:

```typescript
import { test, expect, getContext, pb } from './helpers/test-context';
// pb is the PocketBase client from global-setup, ready to use
// getContext(page) returns a TestContext with login helpers + URL properties
```

### Login helpers

```typescript
test('user can view dashboard', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();  // navigates to /login, fills user creds
    await ctx.waitForDashboard();
    // ctx.page is the raw Playwright Page
});
```

### Credentials and URLs

```typescript
ctx.credentials.adminEmail      // 'admin@test.stjorna.local'
ctx.credentials.adminPassword   // 'admin12345678test'
ctx.credentials.userEmail       // 'user@test.stjorna.local'
ctx.credentials.userPassword    // 'user12345678test'
ctx.pbUrl                       // 'http://localhost:8090'
ctx.frontendUrl                 // 'http://localhost:4173'
ctx.tenantId                    // 'test-company' tenant ID (set by global-setup)
```

### Direct PB access (for API-level tests)

```typescript
import { test, expect, pb } from './helpers/test-context';

test('can create a product via PB', async () => {
    // pb is the PocketBase client with admin auth from global-setup
    const product = await pb.collection('products').create({
        name: 'Test Product',
        slug: 'test-product',
        tenant: ctx.tenantId,
        category: '...',
    });
    expect(product.id).toBeTruthy();
});
```

### For tests that need to call PB without admin context (e.g., user auth)

```typescript
import { test, expect, getContext } from './helpers/test-context';

test('user auth', async ({ page, request }) => {
    const ctx = getContext(page);

    // Use Playwright's request fixture to do a separate auth
    const auth = await request.post(ctx.pbUrl + '/api/admins/auth-with-password', {
        data: { identity: ctx.credentials.adminEmail, password: ctx.credentials.adminPassword },
    });
    expect(auth.ok()).toBeTruthy();
    const token = (await auth.json()).token;

    // Make a request with that token
    const res = await request.get(ctx.pbUrl + '/api/some/endpoint', {
        headers: { Authorization: token },  // PB expects raw token, not "Bearer ..."
    });
});
```

## Schema (v2 — current)

Collections created by `global-setup.ts` in two phases:

**Phase 1 (foundation):** `roles`, `tenants`, `media`
**Phase 2 (dependent):** `categories`, `products`, `user_tenants`

| Collection | Key fields | Notes |
|------------|------------|-------|
| `users` | standard PB auth + `last_tenant` | text field for last selected tenant |
| `roles` | `name`, `description` | lookup for viewer/editor/admin |
| `tenants` | `name`, `slug`, `description`, `users` (relation multi) | |
| `user_tenants` | `user`, `tenant`, `role` (relation) | junction, role is RELATION not text select |
| `categories` | `name`, `slug`, `description`, `tenant` (relation) | |
| `products` | `name`, `slug`, `description`, `price`, `sku`, `tenant`, `category`, `media` (relation multi, max 99) | `media` is relation to media collection, NOT `images` |
| `media` | `name`, `original_name` (readOnly), `file`, `mime_type`, `size`, `s3_url`, `thumbnail_url`, `tenant` | file collection, PB auto-fills mime/size |
| `instance_settings` | `s3_bucket`, `s3_region`, `s3_endpoint`, `s3_access_key` | singleton, PB admin only |

### API Rules (current)

```javascript
// categories, products, media
listRule/viewRule/createRule/updateRule/deleteRule:
  '@request.auth.id != "" || @request.auth.admin = true'

// users
listRule: '@request.auth.id != "" || @request.auth.admin = true'
viewRule: '@request.auth.id = id || @request.auth.admin = true'

// user_tenants
listRule: '@request.auth.id != "" || @request.auth.admin = true'

// instance_settings
listRule: '@request.auth.admin = true'  // PB admin only
```

The `'@request.auth.id != "" || @request.auth.admin = true'` pattern allows both regular users and PB admin to access; specific role-based restrictions are done in the frontend.

## Container Management (global-setup.ts)

Global setup starts a **fresh** container without any volume each run:

```bash
podman run -d --rm --network=host localhost/stjorna-pocketbase:test
```

Then:
1. Waits 8 seconds for PB to start
2. Creates admin via `podman exec ${containerId} ./pocketbase admin create ${EMAIL} ${PASSWORD}`
3. Polls `/api/health` with retries (20 × 1s)
4. Authenticates admin via fetch
5. Creates all collections in phase1 + phase2 order
6. Sets `instance_settings.setup_done = true`
7. Creates test tenant "Test Company" (slug: test-company)
8. Creates regular user `user@test.stjorna.local` / `user12345678test`, linked to test tenant as admin

`replaceIds()` and `replaceCollectionId()` helpers substitute `_TENANTS_ID_`, `_CATEGORIES_ID_`, `_MEDIA_ID_`, `_ROLES_ID_`, `_pb_users_auth_` placeholders in schema definitions with actual IDs from PB.

## Test Data Reset

Each test run gets a **completely fresh** PocketBase instance. No data persists between runs. Tests that need seeded data must create it themselves (e.g., upload media in `beforeEach`).

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
import { test, expect, getContext } from './helpers/test-context';

test.describe('Feature area', () => {
    test.beforeEach(async ({ page }) => {
        const ctx = getContext(page);
        await ctx.loginAsUser();
    });

    test('user can do action X', async ({ page }) => {
        const ctx = getContext(page);
        await ctx.page.goto(ctx.frontendUrl + '/some-path');
        await ctx.page.getByRole('button', { name: 'Action X' }).click();
        await expect(ctx.page.locator('.success-message')).toBeVisible();
    });
});
```

### Selector best practices

```typescript
// PREFER semantic selectors over CSS classes
ctx.page.getByRole('button', { name: 'Submit' })
ctx.page.getByLabel('Email')
ctx.page.getByText('Category Name')

// For table rows, use data-testid or text content
ctx.page.locator('tbody tr:has-text("Test Category")')

// AVOID brittle selectors
ctx.page.locator('.bg-blue-600')  // fragile - use role instead
```

### Waiting for navigation/updates

```typescript
// Wait for URL change
await ctx.page.waitForURL('**/categories');

// Wait for element to appear
await ctx.page.waitForSelector('h1:has-text("Categories")');

// Wait for network idle (after form submission)
await ctx.page.waitForLoadState('networkidle');

// DON'T use arbitrary sleep - use waitForSelector or waitForURL
await ctx.page.waitForTimeout(1000);  // ONLY when truly necessary
```

### API-level tests (no browser)

```typescript
test('GET /api/collections/categories/records requires auth', async ({ request }) => {
    const ctx = getContext(page);
    const res = await request.get(ctx.pbUrl + '/api/collections/categories/records');
    expect(res.status()).toBe(200);  // empty list since not authed + public listRule
});
```

## PB Admin Role Checks (Frontend)

PB admin users (who log in via "Admin Login" on `/login`) do NOT have a `role` field in the auth store because they authenticate via PocketBase admin credentials, not user credentials. Role checks must explicitly check for PB admin:

```typescript
// CORRECT pattern in auth store
isEditorOrAbove: createMemo(() => {
    if (isPBAdmin()) return true;  // PB admin always has editor permissions
    const r = role();
    return r === 'editor' || r === 'admin';
}),
```

## Test Debugging

### Check what's in the Podman container

```bash
# Manual inspection
podman ps
podman logs <container-id>

# Check collections via API
curl http://localhost:8090/api/collections/tenants/records

# Check hook registration
podman logs stjorna-pocketbase-1 2>&1 | grep "\[stjorna\]"
```

### Common issues

1. **Test fails because collections don't exist** → Global setup failed. Check `global-setup.ts` logs in test output
2. **Tests pass in headed mode but fail in headless** → Timing issue. Add `waitForLoadState('networkidle')` after interactions
3. **`setup_done` redirect** → Tests run after global setup sets `setup_done = true`, so `/setup` redirects. This is correct behavior
4. **Stale frontend dist** → Run `npm run test:e2e` (full build) instead of `test:e2e:fast`
5. **API returns 400 for valid request** → Check API rules. Common cause: missing `|| @request.auth.admin = true` for PB admin
6. **PB container won't start** → Check if `localhost/stjorna-pocketbase:test` image exists: `podman images | grep stjorna`
7. **Hook not loaded** → Check `podman logs` for `[stjorna]` messages. Filename must end in `.pb.js` (not `.js`)

### PB hook debugging (live)

```bash
# Watch logs while developing
podman logs -f stjorna-pocketbase-1 | grep "\[stjorna\]"

# Manually trigger a request
curl http://localhost:8090/api/openapi.json | head -c 200

# Reload a hook (touch the file inside container, or `podman cp` to replace)
podman exec stjorna-pocketbase-1 touch /app/pb_hooks/openapi.pb.js
```

## File Permissions Gotcha (Podman)

When copying files into the running container via `podman cp`, the file becomes owned by uid 100999 (the pocketbase user inside the container). The host user can't then modify it. Workaround:

```bash
# As host user (who owns the directory):
rm /path/to/file        # works because you own the dir
cat > /path/to/file     # recreate as host user
podman cp /path/to/file container:/app/path/  # copy to container
```

## API Endpoints (v2)

### PB's built-in
- `GET /api/health` — health check
- `POST /api/admins/auth-with-password` — PB admin login
- `POST /api/collections/users/auth-with-password` — user login
- `GET/POST/PATCH/DELETE /api/collections/{collection}/records[/{id}]` — collection CRUD
- `GET/POST/PATCH /api/collections/{collection}/records[/{id}]/{file_field}` — file download/upload
- `GET /api/files/{collection}/{record_id}/{filename}?thumb=200x200` — file with thumb

### Custom (openapi.pb.js hook)
- `GET /api/openapi.json` and `GET /api/openapi` — OpenAPI 3.0.3 spec (16KB JSON)

## Test File Patterns

### Media upload (uses real PNG, not text)

```typescript
const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,  // PNG header
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,  // IHDR
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  // 1x1
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41, 0x54, 0x78,
    0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01,
    0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82
]);

await fileInput.setInputFiles({
    name: 'test.png',
    mimeType: 'image/png',
    buffer: pngBuffer,
});
```

**Why?** PB's media collection rejects files with `text/plain` mime type. Use a real PNG.

### Product CRUD with media picker

```typescript
// Click to open media picker
await page.locator('[data-testid="open-media-picker"]').click();

// Select media in modal
await page.locator('[data-testid^="media-pick-"]').first().click();

// Confirm selection
await page.locator('button:has-text("Confirm")').click();

// Submit form
await page.getByRole('button', { name: 'Save' }).click();
```

### OpenAPI spec test

```typescript
test('GET /api/openapi.json returns a valid OpenAPI 3.0 spec', async ({ page, request }) => {
    const ctx = getContext(page);
    const res = await request.get(ctx.pbUrl + '/api/openapi.json');
    expect(res.status()).toBe(200);
    const spec = await res.json();

    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info.title).toBe('STJÓRNA API');
    expect(spec.tags.map((t: any) => t.name)).toEqual(
        expect.arrayContaining(['Public', 'Private', 'Admin'])
    );
    expect(spec.components.schemas.Product).toBeDefined();
});
```

### Swagger UI render test

```typescript
test('Swagger UI page loads and renders', async ({ page }) => {
    const ctx = getContext(page);
    await ctx.loginAsUser();
    await page.goto(ctx.frontendUrl + '/api-docs');

    await expect(page.locator('h1:has-text("API Documentation")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="swagger-ui"] .swagger-ui')).toBeVisible({ timeout: 15000 });
    // Tag sections visible
    await expect(page.locator('.swagger-ui section').first()).toBeVisible();
});
```

## Frontend Changes Between Test Runs

`npm run test:e2e` runs `npm run build --prefix frontend` first, ensuring the latest code is tested. Use `npm run test:e2e:fast` during development when you know the build is current.

## Known Limitations

### PB admin tenant query in create forms
PB admin users logging in via admin auth have `pb.authStore.isAdmin = true` but their auth token does NOT grant them direct access to tenant collection records via normal API calls. The `tenants` listRule requires a `user_tenants` relation, which PB admin users don't have. As a result, create forms that need to auto-select a tenant for PB admin will fail the tenant fallback query. Workaround: pre-fetch tenant ID from `global-setup.ts` context and inject it.

### Setup redirect test
The test for `/setup` redirect when `setup_done=true` requires setting both `stjorna_pb_url` and `pb_setup_done` in localStorage, and the redirect check in `Setup.tsx` fetches from PocketBase (requires auth). This test is currently skipped.

### S3 test endpoint
PB's built-in `/api/settings/test/s3` fails on Scaleway because `DeletePrefix` uses `ListObjectsV2` which Scaleway rejects. Use record-based S3 test (upload a real media record, then fetch+delete it) instead.

## Adding a New Test File

1. Create `tests/e2e/new-feature.spec.ts`
2. Import from `./helpers/test-context`:
   ```typescript
   import { test, expect, getContext, pb } from './helpers/test-context';
   ```
3. Add tests following the patterns above
4. Run: `npx playwright test tests/e2e/new-feature.spec.ts`

## Related Skills
- `pocketbase-jsvm-hooks` — PB v0.22.7 JS hook gotchas (loader/executor VM, response writing, file patterns)
- `stjorna-architecture` — STJÓRNA architecture, schema, role model, S3, OpenAPI
