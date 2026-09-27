# secanis/stjorna-pocketbase

Backend image for [STJÓRNA](https://github.com/secanis/stjorna) — PocketBase v0.40 with STJÓRNA's JS hooks, migrations, and OpenAPI endpoint pre-installed.

Run it standalone for development, or pair with `secanis/stjorna-frontend` for the full app. For production on Kubernetes use the [Helm chart](https://secanis.github.io/stjorna/).

## Quick start

```bash
docker run -d --rm --name stjorna-pb \
  -p 8090:8090 \
  -e PB_SECRET=$(openssl rand -hex 16) \
  -e PB_SUPERUSER_EMAIL=admin@example.com \
  -e PB_SUPERUSER_PASSWORD=changeme \
  -v stjorna-pb-data:/app/pb_data \
  secanis/stjorna-pocketbase:latest
```

Open <http://localhost:8090/_/> and log in with the superuser credentials above.

## Image details

| | |
|---|---|
| Base | `alpine:3.19` |
| PocketBase | v0.40.4 |
| User | `pocketbase` (uid 1000) |
| Port | `8090` (HTTP) |
| Volume | `/app/pb_data` (SQLite + uploads) |
| Entrypoint | `/app/entrypoint.sh` |

## Tags

| Tag | Example | Source |
|---|---|---|
| `latest` | `latest` | `main` branch builds |
| `vX.Y.Z` | `v3.0.0-rc8` | Git tag `v*` |
| `X.Y.Z` | `3.0.0-rc8` | semver expansion |
| `X.Y` | `3.0` | semver expansion |
| `X` | `3` | semver expansion |

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PB_SECRET` | recommended | Exactly **32 characters**. AES-256 encryption key for `pb_data`. Generate with `openssl rand -hex 16`. The container refuses to start without it to prevent silent unencrypted boots. |
| `PB_SUPERUSER_EMAIL` | first run only | Creates the initial admin on a fresh `/app/pb_data`. Skipped on subsequent restarts. |
| `PB_SUPERUSER_PASSWORD` | first run only | Same as above. Pick a real password for anything beyond local dev. |
| `PB_SUPERUSER_IPS` | optional | CIDR allowlist for the superuser admin UI. Set e.g. `10.0.0.0/8 172.16.0.0/12` to restrict. |
| `PB_AUTOMIGRATE` | optional | `true` (default) runs bundled JS migrations + hooks on start. Set `false` for read-only deployments.

## Volumes

`/app/pb_data` holds SQLite, uploaded media (when S3 is not configured), and a `.superuser-bootstrapped` marker file. Mount a named volume or a host bind-mount to persist data across container restarts.

```bash
# Named volume (recommended)
docker volume create stjorna-pb-data
docker run ... -v stjorna-pb-data:/app/pb_data ...

# Host bind-mount
docker run ... -v /var/lib/stjorna/pb_data:/app/pb_data ...
```

## What's inside

- PocketBase v0.40 binary
- STJÓRNA JS hooks (`pb_hooks/`) — OpenAPI spec, file-deletion cleanup, custom endpoints
- STJÓRNA migrations (`pb_migrations/`) — schema for tenants, products, categories, media, users, roles
- `entrypoint.sh` — handles superuser bootstrap, encryption flag, IP whitelist

## Links

- Docs site (with live Swagger UI): <https://secanis.github.io/stjorna/>
- Helm chart: <https://secanis.github.io/stjorna/> (Install tab)
- GitHub: <https://github.com/secanis/stjorna>
- Issues: <https://github.com/secanis/stjorna/issues>
- Artifact Hub: <https://artifacthub.io/packages/helm/secanis/stjorna>