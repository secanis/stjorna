---
name: stjorna-architecture
description: Provides architecture guidance for STJÓRNA product management application. Use when discussing STJÓRNA redesign, PocketBase collection design, SolidJS frontend, multi-tenant role model, S3 file storage, OpenAPI docs, or Helm/Kubernetes deployment for STJÓRNA.
---

# STJÓRNA Architecture Skill

## Overview

STJÓRNA is a multi-tenant product/media management application with three API tiers (Public, Private, Admin), S3-backed media storage, and a built-in OpenAPI/Swagger UI. The name means "manage" or "store stuff" in Icelandic.

### Core Features
- Product, Category, and Media management with multi-image per product
- Multi-tenant with role-based access (viewer/editor/admin/pb_admin)
- Public read-only REST API (no auth) for storefronts/third-party apps
- Private authenticated user CRUD
- Admin endpoints for tenant + user management
- S3-compatible media storage (Scaleway/AWS/any S3)
- Auto-generated OpenAPI 3.0.3 spec served at `/api/openapi.json` + Swagger UI at `/api-docs`
- Multi-language support (German/English)
- Optional Matomo tracking integration
- Helm chart for Kubernetes deployment

### Current Architecture (v2 - active)

- **Backend:** PocketBase v0.22.7 (single binary, embedded SQLite, JS hooks)
- **Frontend:** SolidJS + TypeScript + TailwindCSS (Vite dev server :3000, builds to static SPA)
- **Storage:** S3-compatible object storage (Scaleway/AWS/MinIO) for media files; local PB filesystem as fallback
- **Tests:** Playwright E2E (fresh Podman container per run) + Vitest unit tests
- **Deployment:** Docker Compose for dev, Helm chart for k8s
- **Repo layout:**
  ```
  stjorna/
  ├── pocketbase/
  │   ├── pb_hooks/                # JS hooks (must be *.pb.js or *.pb.ts)
  │   ├── pb_data/                 # SQLite + uploaded files (gitignored)
  │   └── test/                    # Vitest unit tests for PB logic
  ├── frontend/                    # SolidJS app
  │   ├── src/
  │   │   ├── components/          # Reusable UI + layout
  │   │   ├── pages/               # Route pages
  │   │   ├── services/            # pocketbase.ts singleton
  │   │   ├── stores/              # auth.ts, sidebar.ts
  │   │   ├── types/               # TypeScript interfaces
  │   │   └── utils/               # mediaUrl, slug helpers
  │   ├── .env                     # VITE_PB_URL=http://localhost:8090
  │   └── vite.config.ts           # proxies /api/ → PB
  ├── tests/
  │   ├── e2e/                     # Playwright E2E
  │   └── unit/                    # Vitest unit tests
  ├── scripts/                     # fix-pocketbase.ts etc.
  ├── docker/                      # Dockerfiles
  ├── helm/stjorna/                # Helm chart
  └── .opencode/                   # Skills + plans for AI agents
  ```

---

## Technology Stack

### Backend: PocketBase v0.22.7
- All-in-one: SQLite + REST API + auth + admin UI in one binary
- Built-in JWT auth, no custom implementation
- Admin UI at `/_/`
- S3 file storage via Settings API (not env vars in v0.22.x)
- JS hooks via `pb_hooks/*.pb.js` for custom endpoints + record lifecycle

**Why PocketBase?**
- Perfect fit for STJÓRNA's data model (multi-tenant products, categories, media, users, roles)
- No separate database setup
- Built-in auth + admin UI
- JS hooks enable custom endpoints (e.g., OpenAPI spec) without separate service

### Frontend: SolidJS + TailwindCSS
- SolidJS for fine-grained reactivity (no VDOM)
- @solidjs/router for routing
- @tanstack/solid-query (installed but mostly used directly with `pb.collection()`)
- TailwindCSS for styling
- Vite for dev server (port 3000) and build

**Why SolidJS?**
- Fast, small bundle, native TS
- Better fit for SPA than React when no VDOM overhead is needed

### Infrastructure
- Docker Compose for local dev (PB + frontend on host network)
- Helm chart for k8s deployment
- S3-compatible storage for media backup/sync (Scaleway used in production)
- Caddy/nginx in front of PB for HTTPS termination

---

## Data Model (PocketBase v2 Schema)

### Collections

#### `users` (built-in auth collection, extended)
- Standard PocketBase auth fields (email, password, verified, etc.)
- `last_tenant` (text, optional) — remembers last selected tenant per user

#### `roles` (singleton lookup)
| Field | Type | Notes |
|-------|------|-------|
| `name` | text | `viewer`, `editor`, `admin` (per-tenant role) |
| `description` | text | Human-readable |

Note: `pb_admin` is NOT in this collection — it's a PocketBase admin user, separate from collection users.

#### `tenants`
| Field | Type | Notes |
|-------|------|-------|
| `name` | text | required |
| `slug` | text | URL-friendly identifier |
| `description` | text | |
| `users` | relation → users | multi-select (max 99), back-ref only |

#### `user_tenants` (junction)
| Field | Type | Notes |
|-------|------|-------|
| `user` | relation → users | required |
| `tenant` | relation → tenants | required |
| `role` | relation → roles | required (not text select) |

#### `categories`
| Field | Type | Notes |
|-------|------|-------|
| `name` | text | required |
| `slug` | text | required, URL-friendly |
| `description` | text | |
| `tenant` | relation → tenants | required |

#### `products`
| Field | Type | Notes |
|-------|------|-------|
| `name` | text | required |
| `slug` | text | required |
| `description` | text | |
| `price` | number | |
| `sku` | text | |
| `tenant` | relation → tenants | required |
| `category` | relation → categories | required |
| `media` | relation → media | maxSelect 99, cascadeDelete false |

#### `media` (file collection)
| Field | Type | Notes |
|-------|------|-------|
| `name` | text | required, display name |
| `original_name` | text | readOnly after upload (set on upload) |
| `file` | file | required, the actual file (PB-managed storage) |
| `mime_type` | text | auto-set by PB |
| `size` | number | auto-set by PB |
| `s3_url` | text | canonical URL after S3 upload (set by hook) |
| `thumbnail_url` | text | S3 thumb URL with `?thumb=200x200` |
| `tenant` | relation → tenants | required |

#### `instance_settings` (singleton)
| Field | Type | Notes |
|-------|------|-------|
| `s3_bucket` | text | |
| `s3_region` | text | |
| `s3_endpoint` | text | auto-filled `https://s3.${region}.amazonaws.com` |
| `s3_access_key` | text | |
| `s3_secret_key` | text | |

### API Rules (Guardrails)

Frontend always sends `?filter=tenant = '{currentTenant}'` as primary mechanism.
API rules are the safety net.

```javascript
// categories / products / media (tenant-scoped)
listRule:   '@request.auth.id != "" || @request.auth.admin = true'
viewRule:   '@request.auth.id != "" || @request.auth.admin = true'
createRule: '@request.auth.id != "" || @request.auth.admin = true'
updateRule: '@request.auth.id != "" || @request.auth.admin = true'
deleteRule: '@request.auth.id != "" || @request.auth.admin = true'

// users
listRule:   '@request.auth.id != "" || @request.auth.admin = true'  // PB admin lists all
viewRule:   '@request.auth.id = id || @request.auth.admin = true'

// user_tenants
listRule:   '@request.auth.id != "" || @request.auth.admin = true'

// instance_settings
listRule:   '@request.auth.admin = true'  // PB admin only
viewRule:   '@request.auth.admin = true'
```

Public read of categories/products via `listRule = ""` (empty) is NOT used; instead the frontend uses an `expand` query via user auth. The OpenAPI spec marks public GETs as `Public` tier (no `security`), but the actual rule check is done by PB.

### Authentication Flow
1. User submits `identity` + `password` to `POST /api/collections/users/auth-with-password`
2. PocketBase returns `{ token, record }`
3. Token included in `Authorization: <token>` header (PB expects raw token, not "Bearer ")
4. `pb.authStore.token` is read in frontend, injected into Swagger UI via `requestInterceptor`
5. PB admin users log in separately via `POST /api/admins/auth-with-password`, set `pb.authStore.isAdmin = true`

### Image / Media Handling
- Local: PB stores files in `pb_data/storage/{collection}/{record_id}/`
- S3: PB can sync to S3 via Settings; use `?thumb=100x100` query for thumbnails (PB generates them)
- `getMediaFileUrl(record, file, { thumb: '100x100' })` helper in frontend adds PB token for private files
- File deletion: PB v0.22.7 does NOT auto-delete files when record is deleted — needs `onRecordAfterDeleteRequest` hook with `pb.dao.NewFilesystem().Delete(...)`

### S3 Sync Implementation

PB v0.22.7 has no env-var S3 config (added in v0.23+). Use Settings API:

```typescript
// In Setup.tsx
await pb.settings.update({
  s3: {
    enabled: true,
    bucket: 'stjorna-media',
    region: 'eu-central-1',
    endpoint: 'https://s3.eu-central-1.amazonaws.com',  // auto-filled
    accessKey: '...',
    secret: '...',
    forcePathStyle: false,  // true for MinIO/Scaleway
  }
});
```

**S3 testing gotcha:** PB's built-in `testS3` endpoint fails on Scaleway because it uses `DeletePrefix` (ListObjectsV2-based) which Scaleway rejects. Test S3 by uploading a real media record instead — if upload + fetch + delete works, S3 is correctly configured.

---

## OpenAPI / Swagger UI

### Endpoint
- `GET /api/openapi.json` and `GET /api/openapi` — serve OpenAPI 3.0.3 spec (16KB)
- Spec has 3 tags: `Public`, `Private`, `Admin`
- 14 paths / 27 operations / 11 schemas

### Implementation
- `pocketbase/pb_hooks/openapi.pb.js` — PB JS hook that registers the routes
- Uses `routerAdd('GET', '/api/openapi.json', handler)`
- Handler is created via `new Function("c", "c.response().header().set(...); c.string(200, " + JSON.stringify(JSON_SPEC) + ");")` to inline the pre-serialized spec
- Why `new Function(...)`? See pocketbase-jsvm-hooks skill — values from loader VM don't reach handler VM

### Frontend
- `frontend/src/pages/ApiDocs.tsx` — lazy-loads `swagger-ui-dist@5` via dynamic import
- Renders in `[data-testid="swagger-ui"]` div
- `requestInterceptor` adds `Authorization: <token>` from `pb.authStore.token`
- Sidebar link: `BookOpen` icon → `/api-docs`, visible to editor+
- Route: `frontend/src/App.tsx` `<Route path="/api-docs" component={ApiDocs} />`
- **Vite proxy gotcha:** proxy must be `/api/` (with trailing slash), not `/api` — otherwise Vite matches `/api-docs` too and 404s the SPA route

---

## Frontend (SolidJS)

### Project Structure (actual)
```
frontend/src/
├── App.tsx                     # Router definition
├── components/
│   ├── layout/
│   │   ├── Layout.tsx          # Sidebar + Header + main
│   │   ├── Sidebar.tsx         # Nav items + role gates + counts
│   │   └── Header.tsx
│   ├── media/
│   │   └── (none — all in pages)
│   └── ui/                     # (planned, not yet implemented)
├── pages/
│   ├── Login.tsx               # Unified login (admin or user mode)
│   ├── Setup.tsx               # First-run wizard (4 steps)
│   ├── Dashboard.tsx           # Stats cards + recent activity
│   ├── MediaList.tsx           # Table with thumbnails
│   ├── MediaEdit.tsx           # Create/Edit media
│   ├── CategoryList.tsx
│   ├── CategoryEdit.tsx
│   ├── ProductList.tsx
│   ├── ProductEdit.tsx         # Media picker with drag-drop reorder
│   ├── Settings.tsx
│   ├── InstanceSettings.tsx
│   ├── UserManagement.tsx
│   ├── TenantList.tsx
│   ├── TenantSettings.tsx
│   └── ApiDocs.tsx             # Swagger UI
├── services/
│   └── pocketbase.ts           # PB client singleton
├── stores/
│   ├── auth.ts                 # loadTenants, role, currentTenant
│   └── sidebar.ts              # bump() signal for count refresh
├── types/
│   └── index.ts                # Role, UserTenant, AuthState
└── utils/
    ├── mediaUrl.ts             # getMediaFileUrl(id, file, { thumb })
    └── slug.ts                 # slugify for category/product slugs
```

### Routing (App.tsx actual)
```typescript
<Route path="/setup" component={Setup} />
<Route path="/login" component={Login} />
<Route path="/" component={Layout}>
  <Route path="/" component={Dashboard} />
  <Route path="/media/new" component={MediaEdit} />
  <Route path="/media/:id" component={MediaEdit} />
  <Route path="/media" component={MediaList} />
  <Route path="/categories" component={CategoryList} />
  <Route path="/categories/new" component={CategoryEdit} />
  <Route path="/categories/:id" component={CategoryEdit} />
  <Route path="/products/new" component={ProductEdit} />
  <Route path="/products/:id" component={ProductEdit} />
  <Route path="/products" component={ProductList} />
  <Route path="/settings" component={Settings} />
  <Route path="/settings/instance" component={InstanceSettings} />
  <Route path="/users" component={UserManagement} />
  <Route path="/tenants" component={TenantList} />
  <Route path="/tenants/:id" component={TenantSettings} />
  <Route path="/api-docs" component={ApiDocs} />
</Route>
```

### Vite Config (gotcha)
```typescript
// vite.config.ts
proxy: {
  '/api/': {  // NOTE: trailing slash — without it, /api-docs matches!
    target: 'http://localhost:8090',
    changeOrigin: true,
  },
},
```

### PB URL Configuration
- Stored in `localStorage` as `stjorna_pb_url` (NOT in env var at runtime)
- Login page reads/writes this key
- Vite dev uses `VITE_PB_URL=http://localhost:8090` for initial build-time default
- Multi-environment: same frontend build can talk to any PB instance

### Auth Store
- `authStore.user` — current user record (or null)
- `authStore.tenants` — list of `UserTenant` with expanded `tenant` and `role`
- `authStore.currentTenant` — ID of currently selected tenant
- `authStore.role` — current role name ('viewer'/'editor'/'admin'/null)
- `authStore.isPBAdmin` — true if logged in via admins auth
- `authStore.isEditorOrAbove()` — memoized check including PB admin override

### Role Model
| Role | Description |
|------|-------------|
| `viewer` | Read-only access within their tenant |
| `editor` | Full CRUD on content (products, categories, media) within their tenant |
| `admin` | Tenant admin — manages users + content within their tenant |
| `pb_admin` | PocketBase system admin — manages all tenants + users |

A user belongs to one or more tenants via `user_tenants` junction. Each assignment has its own role (can be editor in Tenant A, viewer in Tenant B).

---

## Docker Setup

### docker-compose.yml (actual)
```yaml
services:
  pocketbase:
    build: ./pocketbase
    ports: ["8090:8090"]
    volumes: ["./pocketbase/pb_data:/app/pb_data"]
    environment: ["PB_SECRET=<generated>"]
    network_mode: host  # for test framework to access
```

### Build & Run
```bash
# Local dev (hot reload)
cd frontend && npm run dev    # http://localhost:3000
podman run -d --rm --network=host -v $(pwd)/pocketbase/pb_data:/app/pb_data \
  --name stjorna-pocketbase-1 localhost/stjorna-pocketbase:test

# Production
docker-compose up -d --build
```

---

## Helm Chart

Production deployment: `helm/stjorna/` (chart 0.1.0, appVersion v2.0.0). Two separate Deployments (PB + frontend) for independent scaling/restarts, matching the docker-compose shape.

### Structure
```
helm/stjorna/
├── Chart.yaml
├── values.yaml
├── .helmignore
├── README.md
└── templates/
    ├── _helpers.tpl
    ├── NOTES.txt
    ├── namespace.yaml         # idempotent: lookup-guarded render
    ├── serviceaccount.yaml
    ├── secret.yaml            # PB_SECRET auto-gen, pre-install hook
    ├── pocketbase-configmap.yaml   # pb_hooks/*.pb.js
    ├── pocketbase-pvc.yaml    # reclaimPolicy: Retain
    ├── pocketbase-deployment.yaml
    ├── pocketbase-service.yaml
    ├── frontend-configmap.yaml     # nginx.conf with /api proxy to PB svc
    ├── frontend-deployment.yaml
    ├── frontend-service.yaml
    ├── ingress.yaml           # Traefik + cert-manager
    └── tests/
        └── test-connection.yaml
```

### Key design decisions (locked in)

| Decision | Choice | Why |
|---|---|---|
| Architecture | 2 separate Deployments + Services | mirrors docker-compose, independent scaling |
| PocketBase object | Deployment + PVC (not StatefulSet) | no value at 1 replica; PVC binding works identically |
| Hooks delivery | ConfigMap mount (default) | versioned with chart; no image rebuild on hook change |
| PVC retention | `Retain` (not `Delete`) | data survives `helm uninstall`; manual cleanup |
| Ingress | Traefik + cert-manager `letsencrypt` | matches target cluster's tooling |
| Image registry | docker.io (public) by default | pull secrets empty |
| `VITE_PB_URL` | build-time only | in-cluster, frontend proxies `/api/*` via nginx to PB service |
| Image pull secrets | `[]` (none) | docker.io public images; user overrides for private registry |

### values.yaml highlights

- `pocketbase.image.repository: docker.io/secanis/stjorna-pocketbase`
- `pocketbase.image.tag: v2.0.0` (follows STJÓRNA version)
- `pocketbase.persistence.size: 5Gi`, `storageClass: longhorn`
- `pocketbase.secret.existingSecret: ""` (empty ⇒ chart auto-generates; set to a Secret name to bring your own)
- `ingress.className: traefik` with `cert-manager.io/cluster-issuer: letsencrypt`
- `ingress.hosts[0].host: stjorna.example.com` (override at install)

### Install

```bash
# Build and push images first
podman build -t docker.io/secanis/stjorna-pocketbase:v2.0.0 -f docker/Dockerfile.pocketbase pocketbase
podman push docker.io/secanis/stjorna-pocketbase:v2.0.0
podman build -t docker.io/secanis/stjorna-frontend:v2.0.0 -f frontend/Dockerfile frontend
podman push docker.io/secanis/stjorna-frontend:v2.0.0

# Install (override host at minimum)
helm install stjorna ./helm/stjorna \
  --set ingress.hosts[0].host=stjorna.yourdomain.com
```

### Hooks iteration

Hooks live as ConfigMap keys; `helm upgrade` re-renders them and PB's `HooksWatch` reloads changed files. **Caveat:** `HooksWatch` only re-loads CHANGED existing files. New files require `kubectl rollout restart deployment/stjorna-pocketbase -n stjorna`.

### Out of scope (in this chart)

- CI/CD pipeline (build & push is manual)
- Prometheus / Grafana integration (no metrics scraping)
- HA / clustering (PB is single-replica sqlite)
- DNS automation (no external-dns in cluster — create A/CNAME manually)
- HPA, PDB, NetworkPolicy, ExternalSecret (deferred; can be added as opt-in values)

---

## Local Development Workflow

### Prerequisites
- Node.js 20+
- Podman (or Docker)
- S3-compatible storage account (optional, falls back to local)

### One-time setup
```bash
cd pocketbase && ./pocketbase serve  # creates admin at first run
# Visit http://localhost:8090/_/ to create admin
cd ../frontend && npm install
cp .env.example .env  # contains VITE_PB_URL
```

### Dev loop
```bash
# Terminal 1: PB
podman run -d --rm --network=host -v $(pwd)/pocketbase/pb_data:/app/pb_data \
  --name stjorna-pocketbase-1 localhost/stjorna-pocketbase:test

# Terminal 2: Vite
cd frontend && npm run dev

# Open http://localhost:3000 → first visit redirects to /setup
```

### Hot-reload PB hooks
- PB watches `pb_hooks/` for changes to existing files
- New files require container restart
- File ownership: `podman cp` creates files owned by uid 100999 (pocketbase user)
  - Workaround: `rm` the file (host user owns the dir), then `cat > file` to recreate

### Environment Variables
```env
# frontend/.env
VITE_PB_URL=http://localhost:8090

# PocketBase env
PB_SECRET=your-generated-secret-32-chars-min
```

---

## Key Gotchas (Quick Reference)

### PocketBase v0.22.7 JS Hooks
- **Files must end in `.pb.js` or `.pb.ts`** (default `HooksFilesPattern`)
- **Hook handler runs in a separate VM from the file loader** — top-level `let`/`var`/`globalThis.X` are NOT visible in handler scope. Use `new Function("c", "...")` to inline values, or define handler inline with literal values
- **`c.json()` fails on complex nested objects** with generic 400 — use `c.string(200, preSerializedJson)` after `c.response().header().set('Content-Type', 'application/json; charset=utf-8')`
- **`c.response().write(str)` exists but does NOT write** (returns 200 with empty body) — use `c.string()` or `c.blob()` instead
- **`c.send()` does NOT exist in v0.22.7** (added in v0.23+)
- **HooksWatch only re-loads CHANGED existing files**, not new files
- See `pocketbase-jsvm-hooks` skill for full details

### Vite Proxy
- Use `/api/` (with trailing slash), not `/api` — otherwise `/api-docs` route is hijacked

### File Deletion
- `pb.collection('media').delete(id)` only removes DB row, NOT the file
- Need `onRecordAfterDeleteRequest` hook + `pb.dao.NewFilesystem().Delete(...)`

### S3
- PB v0.22.7 has no env-var S3 — use Settings API
- `testS3` endpoint fails on Scaleway — test via real upload+fetch+delete instead

### Auth
- PB expects raw token in `Authorization` header (NOT `Bearer <token>`)
- PB admin login uses separate `/api/admins/auth-with-password` endpoint
- PB admin users have `pb.authStore.isAdmin = true` but no `role` field — must check `isPBAdmin()` explicitly

### File Permissions (podman)
- `podman cp` creates files owned by uid 100999
- Host user (matth) can't modify them
- Workaround: `rm` (host owns dir) + `cat > file` or `podman cp` again

---

## Next Steps (Roadmap)

1. **Add file cleanup hook**: a new `media.pb.js` hook with `onRecordAfterDeleteRequest` that calls `pb.dao().newFilesystem().Delete(originalName, record.id)` to actually remove files from PB storage on record delete.
2. **Run full E2E suite**: `npx playwright test tests/e2e/api-docs.spec.ts` then full suite.
3. **Add unit tests for pocketbase/test**: `pocketbase/test/setup.ts` and `vitest.config.ts` exist but tests are not yet written for v2 schema.
4. **Verify Scaleway S3 upload+delete** with real bucket (currently uses `pbS3Valid` record-based test that mocks).
5. **Add webhook dispatch** for product/category create/update events (when a real consumer needs it).
6. **Add per-tenant user_tenants filter** to ensure PB admin only sees their tenant's data when in "tenant context" (currently PB admin sees all via `|| @request.auth.admin = true`).
7. **Add i18n** (German/English) — currently English-only.
8. **Add Matomo tracking** — currently disabled.

---

## Related Skills
- `pocketbase-jsvm-hooks` — PocketBase v0.22.7 JS hook gotchas (loader/executor VM, response writing, file patterns)
- `stjorna-e2e-testing` — Playwright E2E test setup, schema, patterns, debugging
