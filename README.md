# STJÓRNA v3

Multi-tenant product management built with SolidJS + PocketBase.

## Quick Start (Docker)

```bash
cp .env.example .env
# Edit .env to set PB_SECRET (generate with: openssl rand -hex 32)

docker compose up -d
# or: podman compose up -d

# Open http://localhost:3000 and run through the setup wizard
```

## Storage

STJÓRNA supports two storage backends, configured in the setup wizard
(Admin → Storage step) or manually via environment variables.

### Local filesystem (default)

Files are stored inside the PocketBase container at
`pb_data/storage/{collection_id}/{record_id}/{filename}`.

**For development:** the default works out of the box.

**For production:** mount `pb_data` as a host volume to persist data across
container restarts. The volume mount is commented out in
`docker-compose.yml`:

```yaml
volumes:
    - ./pocketbase/pb_data:/app/pb_data
```

### S3 (recommended for production)

PocketBase v0.22.7 has built-in S3 support. Works with any S3-compatible
provider: AWS S3, Cloudflare R2, Backblaze B2, MinIO, etc.

**Important:** PB v0.22.7 does **not** support the `PB_STORAGE_S3_*` env vars.
S3 is configured exclusively through the PocketBase Settings table. The
setup wizard saves the config via `pb.settings.update({ s3: { ... } })`,
which immediately activates S3 for new uploads — no restart required.

#### Configure via the setup wizard
1. Run the setup wizard (`http://localhost:3000/setup`)
2. At the **Storage** step, select **S3 (or S3-compatible)**
3. Fill in bucket, region, credentials. The endpoint is auto-filled for AWS
   (e.g. `https://s3.eu-central-1.amazonaws.com`) — override for R2 / B2 / MinIO
4. Click **Verify S3 settings** to test the credentials. The wizard:
   - Saves the S3 settings to PocketBase via the Settings API
   - Uploads a small test file (`__stjorna_s3_test__<timestamp>.txt`) to the bucket
     using the media collection (PUT operation)
   - Fetches the file URL to verify it's accessible (GET operation)
   - Deletes the test record (DELETE operation on a specific file)
   - The Continue button is disabled until the test passes
5. Click **Continue** and complete setup

After setup, S3 is active. New uploads go to the configured bucket.

##### About the S3 test

The wizard does **not** use PocketBase's built-in `testS3` endpoint
(`POST /api/settings/test/s3`) because that endpoint calls
`DeletePrefix`, which lists objects with `ListObjectsV2` first. Many
S3-compatible providers (Scaleway, certain MinIO configurations, etc.)
don't support that operation and return a 404. The credentials work
fine, but the cleanup fails and the test reports a spurious failure.

Instead, the wizard does a real round-trip:
- **PUT**: Upload a small test file via the media collection API
- **GET**: Fetch the file URL with the auth token to confirm access
- **DELETE**: Delete the test record (removes the file from the bucket)

All three operations are against a specific, known file key — no
listing, no prefix scanning. This works on every S3-compatible provider
that supports basic object operations (which is essentially all of them).

**If the test fails:**
- Check the access key and secret key (auth errors)
- Check that the bucket name, region, and endpoint are correct
- Check the IAM permissions: `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`
- If the test record could not be auto-deleted, look for
  `__stjorna_s3_test__*.txt` files in the media list and delete them manually

#### Change storage after setup
Use the PocketBase Admin UI:
1. Open `http://localhost:8090/_/`
2. Go to **Settings → Files storage**
3. Toggle S3 enabled, fill in credentials
4. Save

Or, if you have storage config in `instance_settings.storage_type === 's3'`
but PB doesn't have S3 active, run the fix script:
```bash
ADMIN_EMAIL=... ADMIN_PASSWORD=... npm run fix   # run from pocketbase/
```
It re-syncs the S3 config from `instance_settings` to PB's settings table.

### Migration notes

Switching from local to S3 affects **new uploads only**. Existing files
stay where they are. A migration script for moving existing local files
to S3 is not yet provided.

### References

- PocketBase storage docs: https://pocketbase.io/docs/files-handling/#storage-options
- PocketBase settings API: `PATCH /api/settings` with `{ "s3": { ... } }`
- S3 settings fields: `enabled`, `bucket`, `region`, `endpoint`, `accessKey`, `secret`, `forcePathStyle`

## API documentation

STJÓRN ships with an auto-generated OpenAPI 3.0 spec served by PocketBase
and a Swagger UI viewer in the admin GUI.

### Endpoint

```
GET /api/openapi.json
```

Returns the current spec, generated dynamically from the collection
schemas. Implements three API tiers via OpenAPI tags:

| Tag | Auth | Endpoints |
|-----|------|-----------|
| **Public** | none | GET on `products`, `media`, `categories` |
| **Private (User)** | user bearer token | POST/PATCH/DELETE on the same collections |
| **Admin** | admin bearer token | All CRUD on `tenants`, `users`, `user_tenants`, `instance_settings` |

The spec is the **intent**. Actual PB rules are set separately — to match
the tiers, change the collection rules to allow unauthenticated reads for
the Public collections and admin-only writes for Admin ones.

### Viewing

Open `http://localhost:3000/api-docs` while logged in. Swagger UI loads
the spec and renders it with the three tiers as separate sections. The
"Try it out" feature uses the **current session token** automatically
(user or admin, depending on how you're logged in).

### Generating the spec from scratch

The spec is generated by `pocketbase/pb_hooks/openapi.js`. The hook runs
at PB startup and registers the `GET /api/openapi.json` route. To add
new endpoints or tiers, edit the `COLLECTION_TIER` map in that file.

## Development

```bash
# Frontend (SolidJS + Vite)
cd frontend
npm install
npm run dev          # http://localhost:3000

# E2E tests (Playwright, requires PocketBase container)
npm run test:e2e     # full build + e2e
npm run test:e2e:fast  # just e2e (assumes build is current)

# Unit tests for frontend utils
npm test

# PocketBase integration tests
cd ../pocketbase
npm test
```

## Project Structure

```
.
├── frontend/               # v3 SolidJS frontend + Playwright e2e
│   ├── src/
│   │   ├── pages/          # Route components
│   │   ├── components/     # Shared components
│   │   ├── stores/         # Reactive stores
│   │   ├── services/       # PocketBase client, etc.
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Helpers
│   ├── tests/e2e/          # Playwright e2e tests
│   └── package.json
├── pocketbase/             # PocketBase backend + vitest integration tests
│   ├── pb_hooks/           # JS hooks loaded by PB at startup
│   ├── tests/              # Vitest integration tests
│   └── package.json
├── scripts/                # Admin/maintenance scripts
│   ├── fix-pocketbase.ts   # One-time fix for orphaned data + missing rules
│   └── test-api-rules.ts   # Standalone API rules verification
├── helm/stjorna/           # Helm chart for Kubernetes deployment
├── .github/workflows/      # CI/CD (lint, test, build, release)
└── docker-compose.yml
```

## CI/CD

Two GitHub Actions workflows under `.github/workflows/`:

### `ci.yml` — runs on every push and PR

| Job | What it does |
|---|---|
| `test-frontend` | `npm ci && npm run build` (catches TypeScript errors) + vitest |
| `test-pb` | Vitest integration tests in `pocketbase/` |
| `lint-helm` | `make lint-helm` (helm lint + template render check) |
| `test-helm` | Full kind-based end-to-end test (`make test-helm`) — push only, ~3 min |
| `build-images` | Build + push PB and frontend images to **ghcr.io** with branch-specific tags — push only |

Image tags produced by `build-images`:
- `feature-v3-abc123` (branch + short SHA) on every branch push
- `latest` on the default branch

### `release.yml` — runs on `v*` tag push (or manual dispatch)

1. **Build + push images to Docker Hub** (`docker.io/secanis/`) with tags:
   - `v3.0.0` (exact)
   - `3.0.0`, `3.0`, `3` (semver expansion)
   - `latest` (on the default branch only)
2. **Package + publish the helm chart** to the `gh-pages` branch via [`helm/chart-releaser-action`](https://github.com/helm/chart-releaser-action):
   - Updates `helm/stjorna/Chart.yaml`'s `version` and `appVersion` to match the tag
   - Updates `helm/stjorna/values.yaml`'s `pocketbase.image.tag` and `frontend.image.tag` to match
   - Creates a GitHub release with the chart `.tgz` attached
   - Maintains `index.yaml` on `gh-pages` so the chart is installable via:
     ```bash
     helm repo add stjorna https://secanis.github.io/stjorna/
     helm install stjorna stjorna/stjorna
     ```
3. **Notify Artifact Hub** (best-effort) so the chart is indexed promptly.

### Required GitHub secrets

| Secret | Required for | How to create |
|---|---|---|
| `DOCKERHUB_USERNAME` | release.yml | Your Docker Hub username (`secanis`) |
| `DOCKERHUB_TOKEN` | release.yml | [Docker Hub → Account Settings → Security → New Access Token](https://hub.docker.com/settings/security) — scope: Read, Write, Delete |
| `GITHUB_TOKEN` | all workflows | Auto-provided by GitHub Actions |

### First-time setup

1. **Add the secrets** above in the GitHub repo (`Settings → Secrets and variables → Actions`).
2. **Enable GitHub Pages** on the `gh-pages` branch (`Settings → Pages → Source: gh-pages`).
3. **(One-time) Register the chart on Artifact Hub** so it's discoverable from [artifacthub.io](https://artifacthub.io/):
   - Open [https://artifacthub.io/control-panel/repositories?modal=helmRepository](https://artifacthub.io/control-panel/repositories?modal=helmRepository)
   - Click **Add** → **Helm**
   - Set **URL** to `https://secanis.github.io/stjorna/`
   - Set **Display name** to "STJÓRNA"
   - Click **Add** — Artifact Hub will start crawling the repo and indexing the chart

### Cutting a release

```bash
# Tag the commit
git tag v3.0.0
git push origin v3.0.0

# The release workflow will:
#   1. Build + push images to docker.io/secanis/{stjorna-pocketbase,stjorna-frontend}:v3.0.0 (and 3.0.0, 3.0, 3)
#   2. Package the helm chart with version=3.0.0, appVersion=v3.0.0
#   3. Publish the chart to gh-pages
#   4. Create a GitHub release
#   5. Trigger Artifact Hub re-index
```

Or use the manual trigger from the GitHub Actions UI (Actions → Release → Run workflow → enter tag).
