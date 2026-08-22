import { createSignal, createResource, createMemo, For, Show, onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { History, Filter, X, RefreshCw } from 'lucide-solid';
import Table from '~/components/ui/Table';
import { authStore } from '~/stores/auth';
import {
  fetchActivity,
  type ActivityEvent,
  type ActivityType,
  type ActivityAction,
  ALL_ACTIVITY_TYPES,
} from '~/utils/activity';
import {
  ENTITY_TYPE_COLORS,
  ENTITY_TYPE_LABELS,
} from '~/styles/colors';
import { activityColumns, recordHref } from '~/utils/activityColumns';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export default function Activities() {
  const navigate = useNavigate();

  const [types, setTypes] = createSignal<ActivityType[]>([]);
  const [actions, setActions] = createSignal<ActivityAction[]>([]);
  const [from, setFrom] = createSignal<string>(daysAgoISO(30));
  const [to, setTo] = createSignal<string>('');
  const [nameFilter, setNameFilter] = createSignal<string>('');

  onMount(async () => {
    await authStore.init();
    if (!authStore.isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    // Default: nothing selected = "all types the viewer can see"
    setTypes([]);
    setActions([]);
  });

  const queryKey = createMemo(() => ({
    types: types(),
    actions: actions(),
    from: from() || undefined,
    to: to() || undefined,
  }));

  const [events, { refetch }] = createResource(queryKey, (q) =>
    fetchActivity({ ...q, perType: 50 })
  );

  const filtered = createMemo<ActivityEvent[]>(() => {
    const list = events() || [];
    const q = nameFilter().trim().toLowerCase();
    if (!q) return list;
    return list.filter((e) => e.name.toLowerCase().includes(q));
  });

  const toggleType = (t: ActivityType) => {
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));
  };

  const toggleAction = (a: ActivityAction) => {
    setActions((cur) => (cur.includes(a) ? cur.filter((x) => x !== a) : [...cur, a]));
  };

  const resetFilters = () => {
    setTypes([]);
    setActions([]);
    setFrom(daysAgoISO(30));
    setTo('');
    setNameFilter('');
  };

  // Read PB admin status reactively: authStore.init() runs inside onMount
// and flips isPBAdmin true *after* the component body has already
// finished evaluating. A plain `const columns = activityColumns()`
// would snapshot the flag at component-init time (false) and never
// add the Tenant column for admins. The createMemo re-runs once
// authStore.init completes, growing the column list re-actively.
const columns = createMemo(() => activityColumns());

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <History size={24} class="text-gray-500 dark:text-gray-400" />
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Activities</h1>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          class="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-4">
        <div class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <Filter size={14} />
          <span class="font-medium">Filters</span>
          <button
            type="button"
            onClick={resetFilters}
            class="ml-auto text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:text-white flex items-center gap-1"
          >
            <X size={12} /> Reset
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <div class="flex flex-wrap gap-1.5">
              <For each={ALL_ACTIVITY_TYPES}>
                {(t) => {
                  // Hide types the viewer can't see
                  if (!authStore.isPBAdmin && (t === 'tenant' || t === 'user')) return null;
                  const isOn = () => types().includes(t);
                  return (
                    <button
                      type="button"
                      onClick={() => toggleType(t)}
                      classList={{
                        'px-2.5 py-1 rounded text-xs font-medium transition-colors': true,
                        [ENTITY_TYPE_COLORS[t]]: isOn(),
                        'text-white': isOn(),
                        'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600': !isOn(),
                      }}
                    >
                      {ENTITY_TYPE_LABELS[t]}
                    </button>
                  );
                }}
              </For>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Action</label>
            <div class="flex gap-1.5">
              <For each={['created', 'updated'] as ActivityAction[]}>
                {(a) => {
                  const isOn = () => actions().includes(a);
                  return (
                    <button
                      type="button"
                      onClick={() => toggleAction(a)}
                      classList={{
                        'px-2.5 py-1 rounded text-xs font-medium transition-colors': true,
                        'bg-blue-600 text-white': isOn(),
                        'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600': !isOn(),
                      }}
                    >
                      {a}
                    </button>
                  );
                }}
              </For>
            </div>
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1" for="act-from">From</label>
            <input
              id="act-from"
              type="date"
              value={from()}
              max={to() || todayISO()}
              onInput={(e) => setFrom(e.currentTarget.value)}
              class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1" for="act-to">To</label>
            <input
              id="act-to"
              type="date"
              value={to()}
              min={from()}
              max={todayISO()}
              onInput={(e) => setTo(e.currentTarget.value)}
              class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        <div>
          <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1" for="act-search">Name contains</label>
          <input
            id="act-search"
            type="text"
            value={nameFilter()}
            onInput={(e) => setNameFilter(e.currentTarget.value)}
            placeholder="e.g. category name, product title, email…"
            class="w-full bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div class="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
        <Show
          when={!events.loading}
          fallback={<div class="p-4 text-gray-500 dark:text-gray-400">Loading activities…</div>}
        >
          <Table
            columns={columns()}
            data={filtered()}
            onRowClick={(row) => {
              const e = row as ActivityEvent;
              const href = recordHref(e);
              if (href) navigate(href);
            }}
            emptyMessage={
              events()?.length === 0
                ? 'No activity found for the selected filters.'
                : 'No events match the name filter.'
            }
          />
        </Show>
      </div>

      <Show when={filtered().length > 0}>
        <p class="text-xs text-gray-600 dark:text-gray-500">
          Showing {filtered().length} event{filtered().length === 1 ? '' : 's'}
          {filtered().length >= 250 ? ' (capped — clear filters to see more)' : ''}.
        </p>
      </Show>
    </div>
  );
}
