import { createSignal, For, Show } from 'solid-js';
import { apiCalls, clearApiLog } from '~/lib/apiLog';

export default function ApiLog() {
  const [open, setOpen] = createSignal(false);
  const calls = apiCalls;

  const errors = () => calls().filter((c) => !c.ok).length;

  return (
    <>
      <button
        onClick={() => setOpen(!open())}
        class="fixed bottom-3 right-3 z-30 px-3 py-2 rounded-full bg-gray-900 text-white text-xs shadow-lg flex items-center gap-2"
        title="Toggle STJÓRNA API log"
      >
        <span>API</span>
        <span class="bg-gray-700 rounded-full px-2 py-0.5 text-[10px]">{calls().length}</span>
        <Show when={errors() > 0}>
          <span class="bg-red-600 rounded-full px-2 py-0.5 text-[10px]">⚠ {errors()}</span>
        </Show>
      </button>

      <Show when={open()}>
        <div class="fixed bottom-14 right-3 z-30 w-[min(90vw,520px)] max-h-[60vh] overflow-auto bg-gray-950 text-gray-100 border border-gray-800 rounded-lg shadow-2xl text-xs">
          <div class="sticky top-0 bg-gray-900 px-3 py-2 flex items-center justify-between border-b border-gray-800">
            <div>
              <span class="font-semibold">STJÓRNA API log</span>
              <span class="text-gray-400 ml-2">last {calls().length}</span>
            </div>
            <div class="flex items-center gap-2">
              <button onClick={clearApiLog} class="px-2 py-1 rounded hover:bg-gray-800">clear</button>
              <button onClick={() => setOpen(false)} class="px-2 py-1 rounded hover:bg-gray-800">close</button>
            </div>
          </div>
          <Show when={calls().length} fallback={<div class="p-4 text-gray-500">No STJÓRNA calls yet.</div>}>
            <ul class="divide-y divide-gray-800">
              <For each={calls()}>
                {(c) => (
                  <li class="px-3 py-2 font-mono">
                    <div class="flex items-center gap-2">
                      <span class={`px-1.5 rounded text-[10px] ${c.ok ? 'bg-green-700' : 'bg-red-700'}`}>
                        {c.status ?? 'ERR'}
                      </span>
                      <span class="text-gray-400">{c.method}</span>
                      <span class="truncate flex-1">{c.path}</span>
                      <span class="text-gray-500">{c.durationMs}ms</span>
                    </div>
                    <Show when={c.itemCount != null || c.error}>
                      <div class="text-gray-400 mt-1 ml-1">
                        <Show when={c.itemCount != null}>items: {c.itemCount}</Show>
                        <Show when={c.error}> · {c.error}</Show>
                      </div>
                    </Show>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </div>
      </Show>
    </>
  );
}
