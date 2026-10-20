# STJÓRNA v3

Multi-tenant product management built with SolidJS + PocketBase.

## Quick Start (Docker)

```bash
cp .env.example .env
# Edit .env to set PB_SECRET (32 ASCII chars; e.g. `openssl rand -hex 16`).
# NOTE: `openssl rand -hex 32` produces 64 chars and the container will
# refuse to start (T-07) — use `-hex 16` or one of the alternatives in
# .env.example.

docker compose up -d
# or: podman compose up -d

# Open http://localhost:3000 and run through the setup wizard
```

### First-run setup wizard

Both `docker-compose.yml` and the helm chart create the first PocketBase
superuser headlessly on the first boot from `PB_SUPERUSER_EMAIL` /
`PB_SUPERUSER_PASSWORD` (Compose: `.env`, no default — the container refuses
to start with an empty or placeholder password; Helm: a release Secret that is
kept across upgrades and uninstalls, see the helm README for the
`kubectl get secret` command). The frontend
`/setup` wizard then signs in with those credentials.

If those env vars are **not** set (bare `pocketbase serve`, custom
images), the wizard offers to create the first superuser instead. That
path requires a one-time **setup token**: either the `STJORNA_SETUP_TOKEN`
env var (min. 16 chars) or, when unset, a random token that PocketBase
prints to its log at startup:

```bash
docker compose logs pocketbase | grep STJORNA_SETUP_TOKEN
```

The bootstrap route refuses once any superuser exists or once setup has
completed, so it can never be used to mint an extra admin later.

The wizard walks through four steps:

1. **Superuser** — sign in (default) or create with the setup token.
2. **Storage** — local filesystem (default) or S3-compatible bucket.
3. **Tenant** — your first tenant's name and slug (an existing tenant
   with the same slug is reused).
4. **Link** — create the tenant admin account (own password, separate
   from the superuser) and connect it to the tenant. This marks setup as
   done; `/setup` redirects to `/login` from then on.

## Storage

STJÓRNA supports two storage backends. Both are PocketBase's own file
storage settings; the setup wizard (Storage step) or the PocketBase admin
UI writes them, there are no storage environment variables.

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

PocketBase (v0.40) has built-in S3 support. Works with any S3-compatible
provider: AWS S3, Cloudflare R2, Backblaze B2, MinIO, etc.

S3 is configured exclusively through PocketBase's settings (stored
encrypted with `PB_SECRET`); there are no S3 environment variables. The
setup wizard saves the config via `pb.settings.update({ s3: { ... } })`,
which immediately activates S3 for new uploads — no restart required.
STJÓRNA keeps no copy of the storage config or credentials in its own
collections.

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

### Migration notes

Switching from local to S3 affects **new uploads only**. Existing files
stay where they are. A migration script for moving existing local files
to S3 is not yet provided.

### References

- PocketBase storage docs: https://pocketbase.io/docs/files-handling/#storage-options
- PocketBase settings API: `PATCH /api/settings` with `{ "s3": { ... } }`
- S3 settings fields: `enabled`, `bucket`, `region`, `endpoint`, `accessKey`, `secret`, `forcePathStyle`

## Authentication & roles

There are two kinds of accounts:

- **PocketBase superusers** (`_superusers`) — instance operators. They
  sign in to the STJÓRNA admin GUI (and PB's own `/_/` UI) and manage
  tenants, users, memberships, instance settings (OIDC, SMTP, storage)
  and API keys. Superuser logins use MFA (email OTP) once SMTP is
  configured, and can be limited to IP ranges with `PB_SUPERUSER_IPS`.
  The first superuser comes from `PB_SUPERUSER_EMAIL` /
  `PB_SUPERUSER_PASSWORD` or the setup wizard (see above).
- **Users** (`users` auth collection) — tenant members. There is no
  public sign-up; users are created by a superuser or provisioned by OIDC.
  Access to tenant data is granted per tenant through `user_tenants`
  (user, tenant, role) rows:

  | Role | Products / categories / media | Tenant members |
  |---|---|---|
  | `viewer` | read | — |
  | `editor` | read, create, update | — |
  | `admin` | read, create, update, delete | manage `user_tenants` |

  The rules are enforced by the collection API rules (migration
  `1770001000_lock_tenant_isolation.js`), not only by the UI.

**OIDC / SSO**: configured by a superuser under Settings → OIDC. The
provider is registered as a PocketBase OAuth2 provider on the `users`
collection (the client secret is stored only there). On every
OIDC login `pb_hooks/oidc_groups.pb.js` maps the configured groups claim
to tenant memberships and roles (`oidc_group_claim`, `oidc_group_prefix`,
`oidc_role_mapping`, `oidc_sync_mode`); password login can be disabled
for users.

### API keys (machine access)

API keys give a backend/storefront **read-only** access to one tenant.
Superusers manage them in the admin GUI (API Keys) or via the routes in
`pocketbase/pb_hooks/api_keys.pb.js`:

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/stjorna/api-keys` | superuser | issue; the plaintext key is returned **once** |
| `GET /api/stjorna/api-keys` | superuser | list metadata (never the key) |
| `DELETE /api/stjorna/api-keys/{id}` | superuser | revoke (also invalidates issued tokens) |
| `GET /api/stjorna/api-keys/me` | API key | introspect tenant / permissions |
| `POST /api/stjorna/api-keys/exchange` | API key | mint a short-lived (1 h) PocketBase auth token |

Keys look like `stjorna_<tenant6>_<key6>.<secret40>`; only a hash is
stored. Each key is backed by a per-tenant service user that is a
`viewer` member of its tenant. A client sends the key as
`Authorization: Bearer <key>` to `/exchange`, then uses the returned
token as a normal PocketBase auth token for the regular collection API
(`/api/collections/products/records`, …) — so it sees exactly what a
tenant viewer sees, and nothing else. The `demo/` app shows the flow.

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
| **Public** | tenant member or API-key token | GET on `products`, `media`, `categories` |
| **Private (User)** | user bearer token (editor/admin of the tenant) | POST/PATCH/DELETE on the same collections |
| **Admin** | superuser bearer token | All CRUD on `tenants`, `users`, `user_tenants`, `instance_settings` |

The spec describes the endpoints; access is decided by the collection
rules described under [Authentication & roles](#authentication--roles).
There is no anonymous read access.

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

### Connect to a remote PocketBase

Use `dev:remote` to point the frontend at an existing backend (staging,
production, or another dev machine) without running PocketBase locally:

```bash
VITE_PB_URL=https://pb.example.com npm run dev:remote
```

This overrides both the build-time API base URL (`VITE_PB_URL`) and the
Vite dev server proxy (`/api/` → remote backend), so all API calls route
through the remote PocketBase without CORS issues.

You can also put the URL in a `.env.local` file (git-ignored) so you
don't have to type it every time:

```bash
echo 'VITE_PB_URL=https://pb.example.com' > frontend/.env.local
npm run dev:remote
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
├── scripts/                # Helm/kind test rig (test-helm.sh) + CI helpers
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
