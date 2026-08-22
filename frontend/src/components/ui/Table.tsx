import { createSignal, For, Show, JSX } from 'solid-js';

export interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: any, row: any) => JSX.Element;
}

interface TableProps {
  columns: Column[];
  data: any[];
  onSort?: (key: string, dir: 'asc' | 'desc') => void;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onRowClick?: (row: any) => void;
  emptyMessage?: string;
}

export default function Table(props: TableProps) {
  const handleSort = (key: string) => {
    if (!props.columns.find(c => c.key === key)?.sortable) return;
    const newDir = props.sortKey === key && props.sortDir === 'asc' ? 'desc' : 'asc';
    props.onSort?.(key, newDir);
  };

  return (
    <div class="overflow-x-auto">
      <table class="w-full text-sm text-left">
        <thead class="text-xs text-gray-500 dark:text-gray-400 uppercase bg-gray-50 dark:bg-gray-700">
          <tr>
            <For each={props.columns}>
              {(col) => (
                <th
                  class={`px-4 py-3 ${col.sortable ? 'cursor-pointer hover:text-gray-900 dark:text-white' : ''}`}
                  onClick={() => handleSort(col.key)}
                >
                  <div class="flex items-center gap-2">
                    {col.label}
                    <Show when={col.sortable && props.sortKey === col.key}>
                      <span class="text-blue-600 dark:text-blue-400">{props.sortDir === 'asc' ? '↑' : '↓'}</span>
                    </Show>
                  </div>
                </th>
              )}
            </For>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
          <Show
            when={props.data.length > 0}
            fallback={
              <tr>
                <td colspan={props.columns.length} class="px-4 py-8 text-center text-gray-600 dark:text-gray-500">
                  {props.emptyMessage || 'No data'}
                </td>
              </tr>
            }
          >
            <For each={props.data}>
              {(row) => (
                <tr
                  class={`bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 ${props.onRowClick ? 'cursor-pointer' : ''}`}
                  onClick={() => props.onRowClick?.(row)}
                >
                  <For each={props.columns}>
                    {(col) => (
                      <td class="px-4 py-3 text-gray-900 dark:text-white">
                        {col.render
                          ? col.render(row[col.key], row)
                          : String(row[col.key] ?? '')}
                      </td>
                    )}
                  </For>
                </tr>
              )}
            </For>
          </Show>
        </tbody>
      </table>
    </div>
  );
}