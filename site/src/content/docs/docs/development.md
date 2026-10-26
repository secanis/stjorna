---
title: Development
description: Run STJÓRNA locally and contribute.
---

## Prerequisites

- Node.js (see `frontend/package.json` for the tested range)
- Docker or Podman (for the backend / E2E tests)

## Commands

```bash
# Frontend (SolidJS + Vite)
cd frontend
npm install
npm run dev            # http://localhost:3000

# E2E tests (Playwright, requires a PocketBase container)
npm run test:e2e       # full build + e2e
npm run test:e2e:fast  # just e2e (assumes build is current)

# Unit tests for frontend utils
npm test

# PocketBase integration tests
cd ../pocketbase
npm test
```

## Connect to a remote PocketBase

Point the frontend at an existing backend without running PocketBase locally:

```bash
VITE_PB_URL=https://pb.example.com npm run dev:remote
```

Or persist it in a git-ignored `frontend/.env.local`:

```bash
echo 'VITE_PB_URL=https://pb.example.com' > frontend/.env.local
npm run dev:remote
```

## Project structure

```
.
├── frontend/               # v3 SolidJS frontend + Playwright e2e
├── pocketbase/             # PocketBase backend + vitest integration tests
│   ├── pb_hooks/           # JS hooks loaded by PB at startup
│   └── tests/              # Vitest integration tests
├── scripts/                # Helm/kind test rig + CI helpers
├── helm/stjorna/           # Helm chart
├── site/                   # This documentation site (Astro + Starlight)
└── docker-compose.yml
```

## Contributing to this site

```bash
cd site
npm install
npm run dev          # http://localhost:4321
npm run build        # outputs site/dist/
```

Documentation pages are Markdown files under `site/src/content/docs/docs/`. The landing page is
`site/src/pages/index.astro`.

## Gotchas

- **Vite proxy** must use `/api/` (with trailing slash), not `/api` — otherwise the `/api-docs`
  route gets hijacked.
- **Slugs** must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`; generate them with `utils/slug.ts`.
