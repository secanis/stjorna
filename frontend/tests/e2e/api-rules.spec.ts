import PocketBase from 'pocketbase';
import type { Page } from '@playwright/test';
import { test, expect, getContext } from './helpers/test-context';
import { errorMessage } from '../../src/utils/errors';

// Each test gets its own client: the `pb` exported by global-setup only
// exists in Playwright's main process, not in the test workers.

test.describe('API Rules Verification', () => {

  test('tenants collection: viewRule should allow authenticated users', async () => {
    const ctx = getContext(undefined as unknown as Page);
    const pb = new PocketBase(ctx.pbUrl);
    await pb.collection('users').authWithPassword(
      ctx.credentials.userEmail,
      ctx.credentials.userPassword
    );

    try {
      const tenant = await pb.collection('tenants').getOne(ctx.tenantId!);
      expect(tenant.id).toBeTruthy();
      expect(tenant.name).toBeTruthy();
    } catch (e: unknown) {
      throw new Error(`Failed to view tenant: ${errorMessage(e)}`);
    }
  });

  test('roles collection: viewRule should allow authenticated users', async () => {
    const ctx = getContext(undefined as unknown as Page);
    const pb = new PocketBase(ctx.pbUrl);
    await pb.collection('users').authWithPassword(
      ctx.credentials.userEmail,
      ctx.credentials.userPassword
    );

    try {
      const roles = await pb.collection('roles').getList(1, 10);
      expect(roles.items.length).toBeGreaterThan(0);
    } catch (e: unknown) {
      throw new Error(`Failed to list roles: ${errorMessage(e)}`);
    }
  });

  test('user_tenants expand should include tenant and role data', async () => {
    const ctx = getContext(undefined as unknown as Page);
    const pb = new PocketBase(ctx.pbUrl);
    const authData = await pb.collection('users').authWithPassword(
      ctx.credentials.userEmail,
      ctx.credentials.userPassword
    );

    try {
      const result = await pb.collection('user_tenants').getList(1, 1, {
        filter: `user = "${authData.record.id}"`,
        expand: 'tenant,role',
      });

      expect(result.items.length).toBeGreaterThan(0);
      const ut = result.items[0];

      console.log('user_tenants expand result:', JSON.stringify(ut, null, 2));

      expect(ut.expand).toBeDefined();
      expect(ut.expand?.tenant).toBeDefined();
      expect(ut.expand?.role).toBeDefined();
      expect(ut.expand?.tenant?.name).toBeTruthy();
      expect(ut.expand?.role?.name).toBeTruthy();
    } catch (e: unknown) {
      throw new Error(`Failed to expand user_tenants: ${errorMessage(e)}`);
    }
  });

  test('categories should be accessible with tenant filter', async () => {
    const ctx = getContext(undefined as unknown as Page);
    const pb = new PocketBase(ctx.pbUrl);
    await pb.collection('users').authWithPassword(
      ctx.credentials.userEmail,
      ctx.credentials.userPassword
    );

    try {
      const filter = `tenant = "${ctx.tenantId}"`;
      const result = await pb.collection('categories').getList(1, 10, { filter });
      expect(result.totalItems).toBeDefined();
    } catch (e: unknown) {
      throw new Error(`Failed to list categories: ${errorMessage(e)}`);
    }
  });
});
