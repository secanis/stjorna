import { pb, getCurrentTenant } from '~/services/pocketbase';
import { authStore } from '~/stores/auth';

export type ActivityType = 'tenant' | 'user' | 'product' | 'media' | 'category';
// Note: 'deleted' is reserved for a future real audit-log implementation.
// The current "derived" data source only produces 'created' and 'updated'.
export type ActivityAction = 'created' | 'updated' | 'deleted';

export interface ActivityEvent {
  type: ActivityType;
  action: ActivityAction;
  name: string;
  id: string;
  at: string;
  // For tenant filtering (admin only). Undefined = no tenant scope.
  tenant?: string;
}

const getItemName = (item: any, type: ActivityType): string => {
  switch (type) {
    case 'tenant': return item.name;
    case 'user': return item.email;
    case 'product': return item.name;
    case 'media': return item.filename || item.original_name || '(no name)';
    case 'category': return item.name;
  }
};

const COLLECTIONS_BY_TYPE: Record<ActivityType, string> = {
  tenant: 'tenants',
  user: 'users',
  product: 'products',
  media: 'media',
  category: 'categories',
};

export const ALL_ACTIVITY_TYPES: ActivityType[] = [
  'product', 'category', 'media', 'user', 'tenant',
];

export interface ActivityQuery {
  // Type filter. Empty = all types the viewer is allowed to see.
  types?: ActivityType[];
  // Action filter. Empty = both.
  actions?: ActivityAction[];
  // From/to (ISO strings, inclusive). Empty = unbounded.
  from?: string;
  to?: string;
  // Per-type limit when fetching. The default is 50 (good for tables);
  // dashboard uses 5.
  perType?: number;
}

async function fetchCollectionEvents(
  collection: string,
  type: ActivityType,
  perType: number,
  filter?: string
): Promise<ActivityEvent[]> {
  const [byCreated, byUpdated] = await Promise.all([
    pb.collection(collection).getList(1, perType, { filter, sort: '-created' }),
    pb.collection(collection).getList(1, perType, { filter, sort: '-updated' }),
  ]);
  const events: ActivityEvent[] = [];
  byCreated.items.forEach((item: any) => {
    events.push({
      type,
      action: 'created',
      name: getItemName(item, type),
      id: item.id,
      at: item.created,
      tenant: item.tenant || undefined,
    });
  });
  byUpdated.items.forEach((item: any) => {
    if (item.updated && item.updated !== item.created) {
      events.push({
        type,
        action: 'updated',
        name: getItemName(item, type),
        id: item.id,
        at: item.updated,
        tenant: item.tenant || undefined,
      });
    }
  });
  return events;
}

// Viewer-scoped collection types: which types a viewer is allowed to see.
function visibleTypes(): ActivityType[] {
  if (authStore.isPBAdmin) return ['tenant', 'user', 'product', 'media', 'category'];
  return ['product', 'media', 'category'];
}

// Tenant-scoped collection types: which ones we need a tenant filter for.
function tenantScopedTypes(): ActivityType[] {
  return ['product', 'media', 'category'];
}

export async function fetchActivity(query: ActivityQuery = {}): Promise<ActivityEvent[]> {
  const allowed = new Set(visibleTypes());
  const requested = (query.types && query.types.length > 0)
    ? query.types.filter((t) => allowed.has(t))
    : (Array.from(allowed) as ActivityType[]);

  const perType = query.perType ?? 50;
  const actions = new Set(query.actions && query.actions.length > 0 ? query.actions : ['created', 'updated']);
  const filter = getCurrentTenant() ? `tenant = "${getCurrentTenant()}"` : '';

  const collectionsToFetch = requested
    .map((t) => ({ type: t, collection: COLLECTIONS_BY_TYPE[t] }))
    .filter(({ type }) => authStore.isPBAdmin || !tenantScopedTypes().includes(type) || filter);

  const results = await Promise.all(
    collectionsToFetch.map(({ type, collection }) =>
      fetchCollectionEvents(collection, type, perType, filter).catch(() => [])
    )
  );

  const fromMs = query.from ? new Date(query.from).getTime() : -Infinity;
  const toMs = query.to ? new Date(query.to).getTime() + 24 * 60 * 60 * 1000 - 1 : Infinity;

  const merged = results
    .flat()
    .filter((e) => actions.has(e.action))
    .filter((e) => {
      const ms = new Date(e.at).getTime();
      return ms >= fromMs && ms <= toMs;
    });

  // Dedupe (same record, same action)
  const seen = new Set<string>();
  const deduped = merged.filter((e) => {
    const key = `${e.id}-${e.action}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  deduped.sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  return deduped;
}

// For the dashboard's compact "Recent Activity" widget.
export async function fetchRecentActivity(limit = 10): Promise<ActivityEvent[]> {
  const events = await fetchActivity({ perType: 5 });
  return events.slice(0, limit);
}