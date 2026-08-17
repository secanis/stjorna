import { test, expect, getContext } from './helpers/test-context';

test.describe('API documentation', () => {
    test('GET /api/openapi.json with no auth returns only the Public tag', async ({ page, request }) => {
        const ctx = getContext(page);

        const res = await request.get(ctx.pbUrl + '/api/openapi.json');
        expect(res.status()).toBe(200);
        const spec = await res.json();

        expect(spec.openapi).toBe('3.0.3');
        expect(Array.isArray(spec.tags)).toBe(true);
        const tagNames = spec.tags.map((t: any) => t.name);
        expect(tagNames).toEqual(['Public']);

        // No operations from Private or Admin tiers
        for (const path of Object.values<any>(spec.paths)) {
            for (const op of Object.values<any>(path)) {
                if (op && Array.isArray(op.tags)) {
                    expect(op.tags).toEqual(['Public']);
                }
            }
        }

        // Admin-only and Private-only paths must be absent
        expect(spec.paths['/collections/user_tenants/records']).toBeUndefined();
        expect(spec.paths['/collections/instance_settings/records']).toBeUndefined();
        expect(spec.paths['/collections/tenants/records/{id}']).toBeUndefined();

        // /collections/products/records must only have GET (no POST/PATCH/DELETE)
        const products = spec.paths['/collections/products/records'];
        expect(products.get).toBeDefined();
        expect(products.post).toBeUndefined();

        // Public endpoints present
        expect(spec.paths['/health']).toBeDefined();
        expect(spec.paths['/collections/categories/records'].get).toBeDefined();
    });

    test('GET /api/openapi.json with an invalid token returns only the Public tag', async ({ page, request }) => {
        const ctx = getContext(page);

        const res = await request.get(ctx.pbUrl + '/api/openapi.json', {
            headers: { Authorization: 'not-a-valid-jwt' },
        });
        expect(res.status()).toBe(200);
        const spec = await res.json();

        const tagNames = spec.tags.map((t: any) => t.name);
        expect(tagNames).toEqual(['Public']);
        expect(spec.paths['/collections/user_tenants/records']).toBeUndefined();
    });

    test('GET /api/openapi.json with a user token returns Public + Private only', async ({ page, request }) => {
        const ctx = getContext(page);

        const authRes = await request.post(ctx.pbUrl + '/api/collections/users/auth-with-password', {
            data: { identity: ctx.credentials.userEmail, password: ctx.credentials.userPassword },
        });
        expect(authRes.status()).toBe(200);
        const { token } = await authRes.json();

        const res = await request.get(ctx.pbUrl + '/api/openapi.json', {
            headers: { Authorization: token },
        });
        expect(res.status()).toBe(200);
        const spec = await res.json();

        const tagNames = spec.tags.map((t: any) => t.name);
        expect(tagNames).toEqual(['Public', 'Private']);

        // Admin paths must be absent
        expect(spec.paths['/collections/user_tenants/records']).toBeUndefined();
        expect(spec.paths['/collections/instance_settings/records']).toBeUndefined();

        // No operation should be tagged Admin
        for (const path of Object.values<any>(spec.paths)) {
            for (const op of Object.values<any>(path)) {
                if (op && Array.isArray(op.tags)) {
                    expect(op.tags.every((t: string) => t !== 'Admin')).toBe(true);
                }
            }
        }

        // Private CRUD operations must be present
        expect(spec.paths['/collections/products/records'].post).toBeDefined();
        expect(spec.paths['/collections/products/records'].post.tags).toEqual(['Private']);
        expect(spec.paths['/collections/media/records'].get).toBeDefined();
        expect(spec.paths['/collections/media/records'].get.tags).toEqual(['Private']);

        // /collections/tenants/records should have GET only (POST is Admin)
        const tenants = spec.paths['/collections/tenants/records'];
        expect(tenants.get).toBeDefined();
        expect(tenants.get.tags).toEqual(['Private']);
        expect(tenants.post).toBeUndefined();
    });

    test('GET /api/openapi.json with an admin token returns the full 3-tier spec', async ({ page, request }) => {
        const ctx = getContext(page);

        const authRes = await request.post(ctx.pbUrl + '/api/admins/auth-with-password', {
            data: { identity: ctx.credentials.adminEmail, password: ctx.credentials.adminPassword },
        });
        expect(authRes.status()).toBe(200);
        const { token } = await authRes.json();

        const res = await request.get(ctx.pbUrl + '/api/openapi.json', {
            headers: { Authorization: token },
        });
        expect(res.status()).toBe(200);
        const spec = await res.json();

        expect(spec.openapi).toBe('3.0.3');
        expect(spec.info.title).toBe('STJÓRNA API');
        expect(spec.info.version).toBeTruthy();

        const tagNames = spec.tags.map((t: any) => t.name);
        expect(tagNames).toContain('Public');
        expect(tagNames).toContain('Private');
        expect(tagNames).toContain('Admin');

        expect(spec.components.securitySchemes.bearerAuth).toBeDefined();
        expect(spec.components.securitySchemes.bearerAuth.type).toBe('http');
        expect(spec.components.securitySchemes.bearerAuth.scheme).toBe('bearer');

        const productsList = spec.paths['/collections/products/records'];
        expect(productsList).toBeDefined();
        expect(productsList.get.tags).toEqual(['Public']);
        expect(productsList.post.tags).toEqual(['Private']);
        expect(productsList.post.security).toEqual([{ bearerAuth: [] }]);

        const productsItem = spec.paths['/collections/products/records/{id}'];
        expect(productsItem).toBeDefined();
        expect(productsItem.get.tags).toEqual(['Public']);
        expect(productsItem.patch.tags).toEqual(['Private']);
        expect(productsItem.delete.tags).toEqual(['Private']);

        const tenantsList = spec.paths['/collections/tenants/records'];
        expect(tenantsList).toBeDefined();
        expect(tenantsList.get.tags).toEqual(['Private']);
        expect(tenantsList.post.tags).toEqual(['Admin']);

        expect(spec.paths['/collections/user_tenants/records']).toBeDefined();
        expect(spec.paths['/collections/user_tenants/records'].get.tags).toEqual(['Admin']);

        expect(spec.components.schemas.Product).toBeDefined();
        expect(spec.components.schemas.Product.type).toBe('object');
        expect(spec.components.schemas.Product.properties.name).toBeDefined();
        expect(spec.components.schemas.Media).toBeDefined();
        expect(spec.components.schemas.Category).toBeDefined();
        expect(spec.components.schemas.Tenant).toBeDefined();
        expect(spec.components.schemas.User).toBeDefined();
    });

    test('Swagger UI page loads and renders', async ({ page }) => {
        const ctx = getContext(page);
        await ctx.loginAsUser();
        await page.goto(ctx.frontendUrl + '/api-docs');

        await expect(page.locator('h1:has-text("API Documentation")')).toBeVisible({ timeout: 10000 });

        const swaggerRoot = page.locator('[data-testid="swagger-ui"]');
        await expect(swaggerRoot).toBeVisible();
        await expect(swaggerRoot.locator('.swagger-ui')).toBeVisible({ timeout: 15000 });

        // A user login sees Public + Private, but NOT the Admin section
        await expect(page.locator('.swagger-ui section:has-text("Public")').first()).toBeVisible({ timeout: 10000 });
        await expect(page.locator('.swagger-ui section:has-text("Private")').first()).toBeVisible();
        await expect(page.locator('.swagger-ui section:has-text("Admin")')).toHaveCount(0);
    });

    test('API Docs sidebar link is visible to editor+', async ({ page }) => {
        const ctx = getContext(page);
        await ctx.loginAsUser();
        await page.waitForSelector('aside');
        const link = page.locator('aside a[href="/api-docs"]');
        await expect(link).toBeVisible();
    });
});
