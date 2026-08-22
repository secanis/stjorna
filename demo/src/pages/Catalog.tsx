import { createSignal, createResource, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { pb, fileUrl, toggleTheme, getTheme, getTokenRaw } from '~/lib/pb';

// Catalog page: lists all categories, then loads products for the selected one.
// STJÓRNA APIs touched:
//   GET /api/collections/categories/records?page=1&perPage=200&sort=sort_order,name
//   GET /api/collections/products/records?filter=category="<id>"&expand=media&sort=sort_order,name
//   GET /api/files/media/<id>/<file>?thumb=300x300[&token=…]

async function fetchCategories() {
  const r = await pb.collection('categories').getList(1, 200, { sort: 'sort_order,name' });
  return r.items as any[];
}

async function fetchProducts(categoryId: string) {
  const r = await pb.collection('products').getList(1, 200, {
    filter: `category="${categoryId}"`,
    expand: 'media',
    sort: 'sort_order,name',
  });
  return r.items as any[];
}

export default function Catalog() {
  const navigate = useNavigate();
  const [selected, setSelected] = createSignal<string | null>(null);
  const [cats] = createResource(fetchCategories);
  const [products] = createResource(selected, fetchProducts);

  return (
    <div class="min-h-screen p-4 md:p-6">
      <div class="max-w-6xl mx-auto space-y-4">
        <header class="flex items-center justify-between">
          <h1 class="text-2xl font-semibold">STJÓRNA Demo</h1>
          <div class="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              class="text-sm px-3 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {getTheme() === 'dark' ? '☀︎ light' : '☾ dark'}
            </button>
            <button
              onClick={() => navigate('/settings')}
              class="text-sm px-3 py-1 rounded border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              ⚙ Settings
            </button>
          </div>
        </header>

        <div class="grid grid-cols-1 md:grid-cols-[260px,1fr] gap-4">
          {/* Categories */}
          <aside class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-3 max-h-[calc(100vh-8rem)] overflow-auto">
            <div class="flex items-center justify-between mb-2">
              <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Categories
              </h2>
              <Show when={cats.loading}>
                <span class="text-xs text-gray-500">loading…</span>
              </Show>
            </div>
            <Show
              when={!cats.error}
              fallback={
                <div class="text-sm text-red-600 dark:text-red-400 p-2">
                  {(cats.error as any)?.message || 'Failed to load categories.'}
                  <div class="mt-2">
                    <button
                      onClick={() => navigate('/settings')}
                      class="text-xs underline"
                    >
                      Open Settings
                    </button>
                  </div>
                </div>
              }
            >
              <Show when={cats()?.length}>
                <ul class="space-y-1">
                  <For each={cats()}>
                    {(c) => (
                      <li>
                        <button
                          onClick={() => setSelected(c.id)}
                          class={`w-full text-left px-3 py-2 rounded text-sm ${
                            selected() === c.id
                              ? 'bg-blue-600 text-white'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                          }`}
                        >
                          <div class="font-medium truncate">{c.name}</div>
                          <div class={`text-xs truncate ${selected() === c.id ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'}`}>
                            {c.slug || '—'}
                          </div>
                        </button>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
              <Show when={!cats.loading && !cats()?.length}>
                <p class="text-sm text-gray-500 dark:text-gray-400 p-2">No categories yet.</p>
              </Show>
            </Show>
          </aside>

          {/* Products */}
          <main class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4 min-h-[calc(100vh-8rem)]">
            <Show
              when={selected()}
              fallback={
                <div class="h-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
                  ← Pick a category to see its products.
                </div>
              }
            >
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  Products
                </h2>
                <Show when={products.loading}>
                  <span class="text-xs text-gray-500">loading…</span>
                </Show>
              </div>

              <Show when={products.error}>
                <div class="text-sm text-red-600 dark:text-red-400">
                  {(products.error as any)?.message || 'Failed to load products.'}
                </div>
              </Show>

              <Show when={!products.loading && !products()?.length}>
                <p class="text-sm text-gray-500 dark:text-gray-400">No products in this category.</p>
              </Show>

              <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                <For each={products()}>
                  {(p) => (
                    <article class="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden flex flex-col">
                      <ProductMedia product={p} />
                      <div class="p-3 space-y-1 flex-1">
                        <h3 class="text-sm font-medium truncate">{p.name}</h3>
                        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {p.slug}
                          <Show when={p.price != null}>
                            <span> · {Number(p.price).toFixed(2)}</span>
                          </Show>
                        </p>
                        <Show when={p.description}>
                          <p class="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                            {p.description}
                          </p>
                        </Show>
                      </div>
                    </article>
                  )}
                </For>
              </div>
            </Show>
          </main>
        </div>
      </div>
    </div>
  );
}

function ProductMedia(props: { product: any }) {
  const expanded = () => props.product.expand?.media;
  const list = () => {
    const e = expanded();
    if (Array.isArray(e)) return e.filter(Boolean);
    if (e) return [e];
    return [];
  };

  return (
    <div class="aspect-square bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
      <Show
        when={list().length > 0}
        fallback={
          <div class="text-center px-2">
            <div class="text-2xl">🔒</div>
            <p class="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
              media hidden
              <Show when={!getTokenRaw()}>
                <span> — paste a token in Settings</span>
              </Show>
            </p>
          </div>
        }
      >
        <img
          src={fileUrl(props.product, list()[0].file, { thumb: '300x300' })}
          alt={list()[0].filename || props.product.name}
          class="w-full h-full object-cover"
          loading="lazy"
          onError={(e) => ((e.currentTarget.style.display = 'none'))}
        />
      </Show>
    </div>
  );
}
