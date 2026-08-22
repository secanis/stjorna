# STJÓRNA Demo

Tiny SolidJS app that consumes a remote STJÓRNA PocketBase instance. Shows all
categories and, on click, the products inside each category with their media.

> **Same stack as STJÓRNA frontend** — SolidJS 1.9, `@solidjs/router` 0.15, the
> official `pocketbase` 0.21 SDK, Tailwind 3.

---

## Run

```bash
cd demo
npm install
npm run dev
```

App boots on http://localhost:5174. Set the STJÓRNA URL on the `/settings`
page first (or via `VITE_DEMO_PB_URL` env at build/dev time).

The dev server proxies `/api/*` to `VITE_DEMO_PB_URL` (default
`http://localhost:8090`) so a same-origin setup works out of the box. For a
remote STJÓRNA instance with a different origin, paste the full URL on the
Settings page — `fetch` will hit it directly (CORS must be enabled).

Build:

```bash
npm run build      # → demo/dist/
npm run preview    # serve the build
```

## Auth token

Categories and products are **public reads** on STJÓRNA — no auth needed.
Media files and their inline `expand` data are **private**. To see product
images, paste either:

- **A STJÓRN A user JWT** — sign in to your STJÓRN A instance in a browser,
  open DevTools → Application → Local Storage → grab `pocketbase_auth`.
- **A STJÓRN A API key** — issue one in **STJÓRN A → API Keys** (admin only),
  paste the plaintext (`stjorna_<…>.<…>`).

The token is stored in `localStorage.demo_pb_token` and applied via
`pb.authStore.save(token, null)` — works for both regular user JWTs and STJÓRNA API keys.

---

## STJÓRNA APIs touched

All calls go through the official `pocketbase` SDK; the same calls the
STJÓRNA frontend uses.

| Where                      | SDK call                                                                                       | HTTP                                                                                              | Auth     |
| -------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------- |
| `Settings.tsx` health      | `pb.health.check()`                                                                            | `GET /api/health`                                                                                 | none     |
| `Catalog.tsx` categories   | `pb.collection('categories').getList(1, 200, { sort: 'sort_order,name' })`                     | `GET /api/collections/categories/records?page=1&perPage=200&sort=sort_order%2Cname`               | none     |
| `Catalog.tsx` products     | `pb.collection('products').getList(1, 200, { filter: 'category="<id>"', expand: 'media', sort })` | `GET /api/collections/products/records?filter=category%3D%22...%22&expand=media&sort=...`         | none¹    |
| product image (`<img>`)    | `pb.files.getURL(record, file, { thumb: '300x300' })`                                          | `GET /api/files/media/<id>/<file>?thumb=300x300[&token=...]`                                      | none¹    |

¹ `expand=media` and file URLs return data only when the request carries a STJÓRNA auth token that is allowed to read the `media` collection. Without a token, products still list, but `expand.media` is empty and images don't load — placeholders are rendered instead.

A live **API Log** panel at the bottom of every page shows each STJÓRNA
request at runtime (method, path, status, duration, item count). It patches
`window.fetch` once at startup; nothing else has to know about it.

---

## Layout

```
src/
├── index.tsx       render + tailwind + route to /settings if URL unset
├── index.css       @tailwind base/components/utilities
├── App.tsx         Router
├── lib/
│   ├── pb.ts       PocketBase client, URL/token signals, file URL helper
│   └── apiLog.ts   fetch monkey-patch → Solid signal
├── pages/
│   ├── Settings.tsx URL + token inputs, health check
│   └── Catalog.tsx  category grid + product grid
└── components/
    └── ApiLog.tsx  bottom drawer with last N STJÓRNA requests
```
