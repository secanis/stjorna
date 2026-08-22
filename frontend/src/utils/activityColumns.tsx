/*
 * Shared activity-stream column definitions.
 * ==========================================
 * Both the Dashboard "Recent Activity" card and the full /activities
 * page used to duplicate these column arrays. Two copies diverged:
 * the Activities page got the `text-white` fix for the Type badge,
 * the Dashboard copy kept the broken `text-gray-900 dark:text-white`
 * pattern. Single source of truth here so any future tweak lands
 * in one place.
 */

import { JSX } from 'solid-js';
import { ENTITY_TYPE_COLORS, ENTITY_TYPE_LABELS, ACTION_COLORS, ENTITY_TYPE_TEXT_COLORS } from '~/styles/colors';
import type { Column } from '~/components/ui/Table';
import type { ActivityType, ActivityAction, ActivityEvent } from '~/utils/activity';
import { authStore } from '~/stores/auth';

// ─────────────────────────────────────────
// Single source for the badge renderers
// ─────────────────────────────────────────

export function TypeBadge(props: { value: unknown }): JSX.Element {
  const t = props.value as ActivityType;
  const bg = ENTITY_TYPE_COLORS[t] ?? 'bg-gray-100 dark:bg-gray-600';
  return (
    <span class={`px-2 py-1 rounded text-xs font-medium ${bg} text-white`}>
      {ENTITY_TYPE_LABELS[t] ?? String(props.value)}
    </span>
  );
}

export function ActionBadge(props: { value: unknown }): JSX.Element {
  const a = props.value as ActivityAction;
  const c = ACTION_COLORS[a] ?? {
    bg: 'bg-gray-100 dark:bg-gray-600',
    text: 'text-gray-700 dark:text-gray-300',
  };
  return (
    <span class={`px-2 py-1 rounded text-xs font-medium ${c.bg} ${c.text}`}>
      {a}
    </span>
  );
}

// ─────────────────────────────────────────
// Record-column link target by entity type
// Used to render the "Record" cell. Centralised
// because two columns definitions need it.
// ─────────────────────────────────────────
export function recordHref(e: ActivityEvent): string | null {
  switch (e.type) {
    case 'product': return `/products/${e.id}`;
    case 'category': return `/categories/${e.id}`;
    case 'media': return `/media/${e.id}`;
    case 'user': return null; // user list/detail not navigable in this app
    case 'tenant': return `/tenants/${e.id}`;
  }
}

// ─────────────────────────────────────────
// Tenant label cell
// ─────────────────────────────────────────
// Renders the tenant where the activity occurred. PB admin gets a clickable
// link to the tenant settings page; everyone else (non-admin) gets a muted
// dash because they only see one tenant anyway and the column would be
// redundant noise.
function TenantCell(props: { value: unknown; row: ActivityEvent }): JSX.Element {
  const name = () => String(props.value ?? '');
  const id = () => props.row.tenant;
  // Type==='tenant' events still resolve a tenantName (= the entity name),
  // so admins can scan the row and click through.
  if (!name()) {
    return <span class="text-gray-400 dark:text-gray-600">—</span>;
  }
  if (authStore.isPBAdmin && id()) {
    return (
      <a
        href={`/tenants/${id()}`}
        class="text-blue-600 dark:text-blue-400 hover:underline text-sm"
      >
        {name()}
      </a>
    );
  }
  return <span class="text-gray-900 dark:text-white text-sm">{name()}</span>;
}

// ─────────────────────────────────────────
// Column definitions
// ─────────────────────────────────────────

// Full activity log table: includes the Record (link to detail) and When columns.
// Tenant column is added at render time so PB admins get the cross-tenant view;
// non-admin viewers already only see their own tenant so the column is omitted.
function getActivityColumns(): Column[] {
  const cols: Column[] = [
    { key: 'type',   label: 'Type',   render: (v) => <TypeBadge value={v} /> },
    { key: 'action', label: 'Action', render: (v) => <ActionBadge value={v} /> },
    { key: 'name',   label: 'Name' },
  ];
  if (authStore.isPBAdmin) {
    cols.push({
      key: 'tenantName',
      label: 'Tenant',
      render: (v, row) => <TenantCell value={v} row={row as ActivityEvent} />,
    });
  }
  cols.push({
    key: 'id',
    label: 'Record',
    render: (v, row) => {
      const e = row as ActivityEvent;
      const href = recordHref(e);
      if (!href) return <span class="text-gray-600 dark:text-gray-500 text-xs font-mono">{String(v).slice(0, 8)}</span>;
      return (
        <a href={href} class="text-blue-600 dark:text-blue-400 hover:underline text-xs font-mono">
          {String(v).slice(0, 8)}
        </a>
      );
    },
  });
  cols.push({ key: 'at', label: 'When', render: (v) => v ? new Date(v as string).toLocaleString() : '-' });
  return cols;
}

// Backward-compatible export. SolidJS re-runs the column consumers each
// render, so calling it once at module-eval works (PB admin flag is set
// before this page mounts in practice). For environments where the
// admin flag flips at runtime, use `getActivityColumns()` directly.
export function activityColumns(): Column[] {
  return getActivityColumns();
}

// Dashboard "Recent Activity" card: no Record column, no extra metadata.
export const dashboardActivityColumns: Column[] = [
  { key: 'type',   label: 'Type',   render: (v) => <TypeBadge value={v} /> },
  { key: 'action', label: 'Action', render: (v) => <ActionBadge value={v} /> },
  { key: 'name',   label: 'Name' },
  { key: 'at',     label: 'When',   render: (v) => v ? new Date(v as string).toLocaleString() : '-' },
];

export { ENTITY_TYPE_TEXT_COLORS };
