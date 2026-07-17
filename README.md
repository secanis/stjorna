# STJÓRNA v2

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
ADMIN_EMAIL=... ADMIN_PASSWORD=... npx tsx scripts/fix-pocketbase.ts
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
cd ..
npm run test:e2e     # full build + e2e
npm run test:e2e:fast  # just e2e (assumes build is current)

# Unit tests for frontend utils
npm run test:unit
```

## Project Structure

```
.
├── client/                 # Legacy v1 (NodeJS) client — not used by v2
├── server/                 # Legacy v1 (NodeJS) server — not used by v2
├── frontend/               # v2 SolidJS frontend
│   ├── src/
│   │   ├── pages/          # Route components
│   │   ├── components/     # Shared components
│   │   ├── stores/         # Reactive stores
│   │   ├── services/       # PocketBase client, etc.
│   │   ├── types/          # TypeScript types
│   │   └── utils/          # Helpers
│   └── package.json
├── pocketbase/             # PocketBase backend
│   ├── pb_hooks/           # JS hooks loaded by PB at startup
│   ├── pb_migrations/      # SQL migrations (v1)
│   └── test/               # Vitest integration tests
├── scripts/                # Admin/maintenance scripts
│   ├── fix-pocketbase.ts   # One-time fix for orphaned data + missing rules
│   ├── test-api-rules.ts   # Standalone API rules verification
│   └── apply-s3-config.ts  # Apply S3 config from instance_settings
├── tests/e2e/              # Playwright e2e tests
└── docker-compose.yml
```
