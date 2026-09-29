# secanis/stjorna-frontend

Frontend image for [STJÓRNA](https://github.com/secanis/stjorna) — SolidJS SPA built with Vite, served by `nginx-unprivileged`.

This image ships the compiled static assets only; it needs the [`secanis/stjorna-pocketbase`](https://hub.docker.com/r/secanis/stjorna-pocketbase) backend reachable at `/api/` to function. For a turnkey deployment use the [Helm chart](https://secanis.github.io/stjorna/).

## Quick start

```bash
# Backend on host network, frontend on a separate container.
docker network create stjorna

docker run -d --rm --name stjorna-pb \
  --network stjorna \
  -e PB_SECRET=$(openssl rand -hex 16) \
  -e PB_SUPERUSER_EMAIL=admin@example.com \
  -e PB_SUPERUSER_PASSWORD="$(openssl rand -base64 18)" \
  -v stjorna-pb-data:/app/pb_data \
  secanis/stjorna-pocketbase:latest

docker run -d --rm --name stjorna-fe \
  --network stjorna \
  -p 8080:8080 \
  secanis/stjorna-frontend:latest
```

Open <http://localhost:8080>. The frontend discovers the backend via the `localStorage` key `stjorna_pb_url` — set it to `http://localhost:8090` (or your reverse-proxied URL) on the login screen if it is not auto-detected.

## Image details

| | |
|---|---|
| Base build | `node:24-alpine` |
| Base runtime | `nginxinc/nginx-unprivileged:1.25-alpine` |
| User | `nginx` (uid 101) |
| Port | `8080` (HTTP) |
| Built with | `STJORNA_VERSION` + `STJORNA_COMMIT` args, stamped into `/version.json` |
| Proxies | `/api/` → configured backend (see below) |

## Tags

| Tag | Example | Source |
|---|---|---|
| `latest` | `latest` | `main` branch builds |
| `vX.Y.Z` | `v3.0.0-rc8` | Git tag `v*` |
| `X.Y.Z` | `3.0.0-rc8` | semver expansion |
| `X.Y` | `3.0` | semver expansion |
| `X` | `3` | semver expansion |

## Backend URL

The container itself does not know your backend URL — the SPA stores it in `localStorage` (`stjorna_pb_url`) at runtime, so the **same image** can talk to any PocketBase instance. During build the default comes from `VITE_PB_URL` (in `frontend/.env`).

To set it permanently for all users on a self-hosted install, point a reverse proxy (Caddy, nginx, Traefik) at the backend and front the SPA — see the [Helm chart](https://secanis.github.io/stjorna/) for the production pattern.

## What's inside

- Compiled SolidJS app (`/usr/share/nginx/html/`)
- `nginx.conf` (in `/etc/nginx/conf.d/default.conf`) — SPA routing + gzip
- `/version.json` — release tag + commit SHA, populated by `scripts/generate-version.mjs`

## Links

- Docs site (with live Swagger UI): <https://secanis.github.io/stjorna/>
- Backend image: <https://hub.docker.com/r/secanis/stjorna-pocketbase>
- Helm chart: <https://secanis.github.io/stjorna/> (Install tab)
- GitHub: <https://github.com/secanis/stjorna>
- Issues: <https://github.com/secanis/stjorna/issues>
- Artifact Hub: <https://artifacthub.io/packages/helm/secanis/stjorna>