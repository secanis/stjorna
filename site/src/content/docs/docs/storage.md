---
title: Storage
description: Local filesystem or S3-compatible object storage for media.
---

STJÓRNA supports two storage backends. Both are PocketBase's own file storage settings, written by
the setup wizard (Storage step) or the PocketBase admin UI — there are no storage environment
variables.

## Local filesystem (default)

Files are stored inside the PocketBase container at
`pb_data/storage/{collection_id}/{record_id}/{filename}`.

- Works out of the box for development.
- `docker-compose.yml` persists `pb_data` in the named volume `pb_data`.
- To use a host directory (owned by uid 1000), replace the volume with
  `- ./pocketbase/pb_data:/app/pb_data`.

## S3 (recommended for production)

PocketBase v0.40 has built-in S3 support and works with any S3-compatible provider: AWS S3,
Cloudflare R2, Backblaze B2, MinIO, and more.

S3 is configured exclusively through PocketBase's settings (stored encrypted with `PB_SECRET`).
The setup wizard saves the config via `pb.settings.update({ s3: { ... } })`, which activates S3 for
new uploads immediately — no restart required. STJÓRNA keeps no copy of the storage config or
credentials in its own collections.

### Configure via the setup wizard

1. Run the setup wizard (`http://localhost:3000/setup`).
2. At the **Storage** step, select **S3 (or S3-compatible)**.
3. Fill in bucket, region and credentials. The endpoint auto-fills for AWS — override it for
   R2 / B2 / MinIO.
4. Click **Verify S3 settings** — the wizard uploads, fetches and deletes a small test file, and
   keeps **Continue** disabled until the test passes.
5. Continue and complete setup.

### Change storage after setup

Use the PocketBase admin UI: **Settings → Files storage** → toggle S3, fill in credentials, save.

## Migration notes

Switching from local to S3 affects **new uploads only**; existing files stay where they are. A
migration script for moving existing local files to S3 is not yet provided.

## References

- [PocketBase storage docs](https://pocketbase.io/docs/files-handling/#storage-options)
- Settings API: `PATCH /api/settings` with `{ "s3": { ... } }`
- S3 settings fields: `enabled`, `bucket`, `region`, `endpoint`, `accessKey`, `secret`,
  `forcePathStyle`
