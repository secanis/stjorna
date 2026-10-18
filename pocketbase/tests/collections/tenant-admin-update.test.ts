import { describe, it, expect, beforeAll } from 'vitest';
import PocketBase from 'pocketbase';
import { createAdminClient, createTenantUser } from '../helpers/client.ts';
import { createTenantFixture } from '../helpers/fixtures.ts';

/**
 * tenants.updateRule (migration 1770001800): a tenant admin may update
 * their own tenant (name, slug, theme_config, ...). Editors/viewers and
 * admins of OTHER tenants may not. Create/delete stay superuser-only.
 */
describe('tenants: tenant admin can update own tenant', () => {
  let tenantId: string;
  let otherTenantId: string;
  let admin: PocketBase;
  let editor: PocketBase;
  let viewer: PocketBase;
  let foreignAdmin: PocketBase;

  beforeAll(async () => {
    const su = await createAdminClient();
    const t1 = await su.collection('tenants').create(createTenantFixture({ name: 'T-Admin-Update A' }));
    const t2 = await su.collection('tenants').create(createTenantFixture({ name: 'T-Admin-Update B' }));
    tenantId = t1.id;
    otherTenantId = t2.id;

    admin = (await createTenantUser(tenantId, 'admin', 'ta-admin')).pb;
    editor = (await createTenantUser(tenantId, 'editor', 'ta-editor')).pb;
    viewer = (await createTenantUser(tenantId, 'viewer', 'ta-viewer')).pb;
    foreignAdmin = (await createTenantUser(otherTenantId, 'admin', 'ta-foreign')).pb;
  });

  it('tenant admin can update name and theme_config', async () => {
    const updated = await admin.collection('tenants').update(tenantId, {
      name: 'Renamed by tenant admin',
      theme_config: { headerBgDark: '#112233', logoMediaId: 'abc123' },
    });
    expect(updated.name).toBe('Renamed by tenant admin');
    expect((updated as any).theme_config.headerBgDark).toBe('#112233');
  });

  it('editor cannot update the tenant', async () => {
    // Editors are members, so viewRule lets them read — the denial is the
    // update rule itself. PB v0.40 reports a failed write rule as 404
    // (not 403), so accept either; both mean "denied".
    const read = await editor.collection('tenants').getOne(tenantId);
    expect(read.id).toBe(tenantId);
    await expect(
      editor.collection('tenants').update(tenantId, { name: 'editor rename' })
    ).rejects.toMatchObject({ status: expect.any(Number) });
    try {
      await editor.collection('tenants').update(tenantId, { name: 'editor rename' });
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect([403, 404]).toContain(e.status);
    }
  });

  it('viewer cannot update the tenant', async () => {
    const read = await viewer.collection('tenants').getOne(tenantId);
    expect(read.id).toBe(tenantId);
    try {
      await viewer.collection('tenants').update(tenantId, { name: 'viewer rename' });
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect([403, 404]).toContain(e.status);
    }
  });

  it('admin of another tenant cannot update this one', async () => {
    // 403 (rule false) or 404 (record not visible) — both mean denied.
    await expect(
      foreignAdmin.collection('tenants').update(tenantId, { name: 'foreign rename' })
    ).rejects.toMatchObject({ status: expect.any(Number) });
    try {
      await foreignAdmin.collection('tenants').update(tenantId, { name: 'foreign rename' });
      expect.unreachable('should have thrown');
    } catch (e: any) {
      expect([403, 404]).toContain(e.status);
    }
  });

  it('tenant admin still cannot create or delete tenants', async () => {
    await expect(
      admin.collection('tenants').create(createTenantFixture({ name: 'admin-created' }))
    ).rejects.toMatchObject({ status: 403 });

    await expect(
      admin.collection('tenants').delete(tenantId)
    ).rejects.toMatchObject({ status: 403 });
  });
});
