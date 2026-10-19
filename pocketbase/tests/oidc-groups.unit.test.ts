import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';

// Load the shared pure helpers from pb_hooks/lib/oidc.js (CommonJS, used by
// both the PB hook and this unit test). createRequire bridges the ESM test
// to the CJS module.
const require = createRequire(import.meta.url);
const { parseGroup, normalizeToStringArray } = require('../pb_hooks/lib/oidc.js');

const DEFAULT_SEPARATOR = '_';
const DEFAULT_MAPPING: Record<string, string> = {
  _admin: 'admin',
  _editor: 'editor',
  _viewer: 'viewer',
};

// Resolves a list of group names against in-memory tenant/role tables —
// mirrors the $app-dependent part of oidc_groups.pb.js (resolveGroupMembership)
// so the mapping + dedupe behaviour can be asserted without a PB runtime.
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

describe('OIDC group claim normalization', () => {
  it('accepts a comma-separated string', () => {
    expect(normalizeToStringArray('a,b, c ,')).toEqual(['a', 'b', 'c']);
  });

  it('accepts an array', () => {
    expect(normalizeToStringArray(['a', ' b', '', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('accepts a nested object (teams/groups)', () => {
    expect(normalizeToStringArray({ teams: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(normalizeToStringArray({ groups: 'x,y' })).toEqual(['x', 'y']);
  });

  it('returns empty for null/undefined/empty', () => {
    expect(normalizeToStringArray(null)).toEqual([]);
    expect(normalizeToStringArray(undefined)).toEqual([]);
    expect(normalizeToStringArray('')).toEqual([]);
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
