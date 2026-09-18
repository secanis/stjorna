import { describe, it, expect } from 'vitest';

// Mirrors the group parsing logic in ../pb_hooks/oidc_groups.pb.js.
// Kept pure so it can be unit-tested without PocketBase runtime.

const DEFAULT_SEPARATOR = '_';
const DEFAULT_MAPPING: Record<string, string> = {
  _admin: 'admin',
  _editor: 'editor',
  _viewer: 'viewer',
};

function parseGroup(
  group: string,
  separator: string,
  roleMapping: Record<string, string>,
  defaultRole: string
): { tenantSlug: string; roleName: string } | null {
  const g = String(group || '').trim();
  if (!g) return null;

  const sepIdx = g.lastIndexOf(separator);
  if (sepIdx < 0 || sepIdx === g.length - 1) return null;

  const tenantSlug = g.substring(0, sepIdx).toLowerCase();
  const suffix = g.substring(sepIdx).toLowerCase();
  const roleName = roleMapping[suffix] || defaultRole;
  return { tenantSlug, roleName };
}

function resolveMemberships(
  groups: (string | number)[],
  tenants: { id: string; slug: string }[],
  roles: { id: string; name: string }[],
  separator = DEFAULT_SEPARATOR,
  roleMapping = DEFAULT_MAPPING,
  defaultRole = 'viewer'
): { tenantId: string; roleId: string }[] {
  const out: { tenantId: string; roleId: string }[] = [];
  const seen = new Set<string>();

  for (const raw of groups) {
    const parsed = parseGroup(String(raw), separator, roleMapping, defaultRole);
    if (!parsed) continue;

    const tenant = tenants.find((t) => t.slug === parsed.tenantSlug);
    if (!tenant) continue;

    const role = roles.find((r) => r.name === parsed.roleName);
    if (!role) continue;

    if (seen.has(tenant.id)) continue;
    seen.add(tenant.id);
    out.push({ tenantId: tenant.id, roleId: role.id });
  }

  return out;
}

describe('OIDC group parser', () => {
  it('parses admin/editor/viewer suffixes', () => {
    expect(parseGroup('acme_admin', '_', DEFAULT_MAPPING, 'viewer')).toEqual({
      tenantSlug: 'acme',
      roleName: 'admin',
    });
    expect(parseGroup('acme_editor', '_', DEFAULT_MAPPING, 'viewer')).toEqual({
      tenantSlug: 'acme',
      roleName: 'editor',
    });
    expect(parseGroup('acme_viewer', '_', DEFAULT_MAPPING, 'viewer')).toEqual({
      tenantSlug: 'acme',
      roleName: 'viewer',
    });
  });

  it('falls back to default role for unknown suffix', () => {
    expect(parseGroup('acme_unknown', '_', DEFAULT_MAPPING, 'viewer')).toEqual({
      tenantSlug: 'acme',
      roleName: 'viewer',
    });
  });

  it('uses custom separator and mapping', () => {
    const mapping = { '-admin': 'admin', '-user': 'editor' };
    expect(parseGroup('acme-admin', '-', mapping, 'viewer')).toEqual({
      tenantSlug: 'acme',
      roleName: 'admin',
    });
  });

  it('ignores malformed groups', () => {
    expect(parseGroup('acme_', '_', DEFAULT_MAPPING, 'viewer')).toBeNull();
    expect(parseGroup('acme', '_', DEFAULT_MAPPING, 'viewer')).toBeNull();
    expect(parseGroup('', '_', DEFAULT_MAPPING, 'viewer')).toBeNull();
  });

  it('lowercases tenant slug', () => {
    expect(parseGroup('ACME_Admin', '_', DEFAULT_MAPPING, 'viewer')).toEqual({
      tenantSlug: 'acme',
      roleName: 'admin',
    });
  });
});

describe('OIDC membership resolver', () => {
  const tenants = [
    { id: 't1', slug: 'acme' },
    { id: 't2', slug: 'globex' },
  ];
  const roles = [
    { id: 'r1', name: 'admin' },
    { id: 'r2', name: 'editor' },
    { id: 'r3', name: 'viewer' },
  ];

  it('resolves multiple tenant memberships', () => {
    const groups = ['acme_admin', 'globex_editor'];
    expect(resolveMemberships(groups, tenants, roles)).toEqual([
      { tenantId: 't1', roleId: 'r1' },
      { tenantId: 't2', roleId: 'r2' },
    ]);
  });

  it('ignores groups for non-existent tenants', () => {
    const groups = ['acme_admin', 'unknown_editor'];
    expect(resolveMemberships(groups, tenants, roles)).toEqual([
      { tenantId: 't1', roleId: 'r1' },
    ]);
  });

  it('deduplicates by tenant (first role wins)', () => {
    const groups = ['acme_admin', 'acme_editor'];
    expect(resolveMemberships(groups, tenants, roles)).toEqual([
      { tenantId: 't1', roleId: 'r1' },
    ]);
  });

  it('handles a single string group', () => {
    const groups = ['acme_viewer'];
    expect(resolveMemberships(groups, tenants, roles)).toEqual([
      { tenantId: 't1', roleId: 'r3' },
    ]);
  });
});
