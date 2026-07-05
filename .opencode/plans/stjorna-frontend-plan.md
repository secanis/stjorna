# STJÓRNA Frontend Implementation Plan

## Overview

Frontend for STJÓRNA — a multi-tenant product/media management application.
Built with SolidJS, TailwindCSS, @solidjs/router, @tanstack/solid-query, and PocketBase SDK.

## Tech Stack

- **Framework:** SolidJS + TypeScript
- **Styling:** TailwindCSS
- **Routing:** @solidjs/router
- **Server state:** @tanstack/solid-query
- **Backend:** PocketBase (existing)
- **Scaffolding:** `npm create solid@latest`, `npx tailwindcss init -p`

## Role Model

| Role | Description |
|------|-------------|
| `viewer` | Read-only access within their tenant |
| `editor` | Full CRUD on content (products, categories, media) within their tenant |
| `admin` | Tenant admin — manages users within their tenant + full content access |
| `pb_admin` | PocketBase admin — system-wide admin, manages tenants + all users across tenants |

A user belongs to one or more tenants via a `user_tenants` junction table. Each assignment has its own role (a user can be editor in Tenant A and viewer in Tenant B).

## Data Model (PocketBase)

### New Collection: `user_tenants`

| Field | Type | Notes |
|-------|------|-------|
| `user` | relation → users | required |
| `tenant` | relation → tenants | required |
| `role` | select: viewer / editor / admin | required |

### API Rules (Guardrails)

All tenant-scoped collections (`categories`, `products`, `media`, `product_media`):
- `listRule`: `@request.auth.user_tenants.tenant = tenant`
- `viewRule`: `@request.auth.user_tenants.tenant = tenant`
- `createRule`: `@request.auth.user_tenants.tenant = tenant`
- `updateRule`: `@request.auth.user_tenants.tenant = tenant`
- `deleteRule`: `@request.auth.user_tenants.tenant = tenant`

`users` collection:
- `listRule`: `@request.auth.id = id`
- `viewRule`: `@request.auth.id = id`

`user_tenants` collection:
- `listRule`: `@request.auth.user_tenants.user = @request.auth.id`
- `viewRule`: `@request.auth.user_tenants.user = @request.auth.id`
- `createRule`: null (admin only via API)
- `updateRule`: `@request.auth.user_tenants.user = @request.auth.id && @request.auth.user_tenants.role = "admin"`
- `deleteRule`: `@request.auth.user_tenants.user = @request.auth.id && @request.auth.user_tenants.role = "admin"`

### Filtering Strategy (Primary)

Frontend always sends explicit tenant filter: `?filter=tenant = '{currentTenant}'`.
API rules act as guardrails (safety net), frontend filters as primary mechanism.

## Pages & Routes

| Route | Component | Access |
|-------|-----------|--------|
| `/setup` | `Setup.tsx` | Public (only when no admin exists) |
| `/login` | `Login.tsx` | Public |
| `/` | `Dashboard.tsx` | Authenticated |
| `/media` | `MediaList.tsx` | Authenticated |
| `/media/new` | `MediaEdit.tsx` | Authenticated (editor+) |
| `/media/:id` | `MediaEdit.tsx` | Authenticated (editor+) |
| `/settings` | `Settings.tsx` | Authenticated (admin) |
| `/users` | `UserManagement.tsx` | Authenticated (admin or pb_admin) |

## Phase 1 — Scaffolding

```bash
npm create solid@latest frontend
# Select: TypeScript, SolidJS App

cd frontend
npx tailwindcss init -p
npm install @solidjs/router @tanstack/solid-query pocketbase
```

## Phase 2 — Project Structure

```
frontend/src/
├── components/
│   ├── ui/                     # Button, Input, Card, Modal, Table, Badge
│   ├── layout/
│   │   ├── Sidebar.tsx         # Nav + tenant switcher + logout
│   │   ├── Header.tsx          # Tenant name + role badge
│   │   └── Layout.tsx          # Sidebar + Header wrapper
│   ├── auth/
│   │   └── LoginForm.tsx
│   └── media/
│       ├── MediaForm.tsx       # File upload + fields
│       └── TenantSwitcher.tsx  # Dropdown for switching tenants
├── pages/
│   ├── Login.tsx               # Unified login (users + admins)
│   ├── Setup.tsx               # First-run wizard (4 steps)
│   ├── Dashboard.tsx           # Stats cards + recent activity table
│   ├── MediaList.tsx           # Table with sort/filter/pagination
│   ├── MediaEdit.tsx           # Create/Edit media
│   ├── Settings.tsx            # Tenant settings
│   └── UserManagement.tsx      # User CRUD within tenant
├── services/
│   └── pocketbase.ts           # PB client singleton
├── stores/
│   └── auth.ts                 # Auth state (signals)
├── types/
│   └── index.ts                # Role, UserTenant, AuthState types
└── App.tsx                     # Router + route guards
```

## Phase 3 — Auth Store

```typescript
interface AuthState {
  pbUrl: string;                 // Stored in localStorage
  user: Record<string, any> | null;
  tenants: UserTenant[];         // Expanded via user_tenants
  currentTenant: string | null;
  role: Role | null;
  isPBAdmin: boolean;
}

interface UserTenant {
  id: string;
  tenant: string;
  role: Role;
}
```

### Auth Store Methods

- `init()` — load pbUrl from localStorage, try to restore session
- `login(email, password)` — POST auth-with-password → fetch user_tenants → set currentTenant to first tenant
- `logout()` — clear store, redirect to /login
- `switchTenant(tenantId)` — update currentTenant, invalidate all queries
- `isAuthenticated()` — derived signal (user !== null)
- `hasRole(role)` — derived signal (checks current role against allowed roles)
- `isPBAdmin()` — true if logged in via admins auth

## Phase 4 — Setup Page (4 Steps)

1. **Connect** — Enter PocketBase URL → check `/api/health`
2. **Initialize** — If no admin exists → show admin creation form → POST `/admins`
3. **Create Tenant** — Create first tenant "Default Company" → POST `tenants`
4. **Link Admin** — Create `user_tenants` record linking admin to tenant with admin role

After completion → redirect to `/login`.

Route `/setup` redirects to `/login` if PocketBase already has admins.

## Phase 5 — Login Page

- PocketBase URL input (pre-filled from localStorage, editable)
- Email + Password inputs
- On success: fetch `user_tenants` expand → set store → redirect to `/`
- Show error for failed login
- Link to `/setup` if no admin exists

## Phase 6 — Dashboard

- Stats cards: Total products, categories, media items, users
- Recent activity: last 10 items created/updated
- Quick actions: Add media, Add product
- Data fetched via @tanstack/solid-query with tenant filter

## Phase 7 — Reusable Table Component

```typescript
interface TableProps {
  columns: Column[];
  data: any[];
  sortable?: boolean;
  filterable?: boolean;
  pagination?: boolean;
  onSort?: (column: string, dir: 'asc' | 'desc') => void;
  onFilter?: (filters: Record<string, string>) => void;
  onPageChange?: (page: number) => void;
}
```

Used by: Dashboard, MediaList, UserManagement

## Phase 8 — Media Management

**MediaList.tsx:**
- Table: thumbnail, filename, mime_type, size, usage_count, created
- Sort by: filename, created, size, usage_count
- Filter by: mime_type (image/video), tenant
- Pagination
- Actions: Edit, Delete (editor+)

**MediaForm.tsx:**
- File upload dropzone (images, videos)
- Auto-populate: mime_type, size, filename
- Manual: original_name, s3_key, s3_url, thumbnail_url
- Image preview

## Phase 9 — Settings & User Management

**Settings.tsx:**
- Tenant name, slug, plan, custom_domain
- Theme config (JSON or form fields)
- Save → PUT `tenants/:id`
- Only visible to admin role

**UserManagement.tsx:**
- PB admin sees all tenants' users
- Tenant admin sees only their tenant's users
- Table: name, email, role, tenant
- Invite: create user + user_tenants entry
- Edit role: PATCH user_tenants
- Deactivate: DELETE user_tenants

## Phase 10 — Tenant Switcher

- Visible in Sidebar (dropdown or tabs)
- Lists all `authStore.tenants`
- On switch: update `currentTenant`, invalidate all queries
- Visual indicator of active tenant

## Phase 11 — Docker

**frontend/Dockerfile:**
```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

**docker-compose.yml:**
- Service `frontend` (build `./frontend`)
- Service `pocketbase` (existing)
- Network: frontend → pocketbase

## Implementation Order

1. Phase 1 — Scaffolding (SolidJS + Tailwind + deps)
2. Phase 2 — Project structure (files + folders)
3. Phase 3 — Core infrastructure (types, pocketbase service, auth store)
4. Phase 4 — Setup + Login pages
5. Phase 5 — Layout components (Sidebar, Header, Layout)
6. Phase 6 — Dashboard + Table component
7. Phase 7 — Media List + Media Form
8. Phase 8 — Settings + User Management
9. Phase 9 — Tenant Switcher
10. Phase 10 — Route guards + role checks
11. Phase 11 — Docker

## File Count Estimate

| Category | Files |
|----------|-------|
| Pages | 7 |
| Components (ui + layout + auth + media) | ~12 |
| Services / Stores / Types | ~5 |
| Config (tailwind, vite, docker) | ~4 |
| **Total** | **~28** |