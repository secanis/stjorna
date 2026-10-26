---
title: Getting started
description: Run STJÓRNA locally with Docker Compose and complete the first-run setup wizard.
---

The fastest way to try STJÓRNA is Docker Compose. It starts a PocketBase backend and the SolidJS
frontend, then walks you through a four-step setup wizard.

## 1. Configure

```bash
cp .env.example .env
# Edit .env to set PB_SECRET (32 ASCII chars; e.g. `openssl rand -hex 16`).
```

:::note
`openssl rand -hex 32` produces 64 characters and the container will refuse to start. Use
`-hex 16`, or one of the alternatives in `.env.example`.
:::

## 2. Start

```bash
docker compose up -d
# or: podman compose up -d
```

## 3. Run the setup wizard

Open <http://localhost:3000> and follow the wizard through four steps:

1. **Superuser** — sign in (default) or create with the one-time setup token.
2. **Storage** — local filesystem (default) or an S3-compatible bucket.
3. **Tenant** — your first tenant's name and slug.
4. **Link** — create the tenant admin account and connect it to the tenant.

Once setup completes, `/setup` redirects to `/login`.

## First-run details

Both `docker-compose.yml` and the Helm chart create the first superuser **headlessly on the first
boot** from `PB_SUPERUSER_EMAIL` / `PB_SUPERUSER_PASSWORD` (Compose: `.env`; Helm: a release
Secret). The wizard then only has to sign in with those credentials.

If those variables are **not** set, the wizard offers to create the first superuser instead. That
path needs a one-time **setup token**: the `STJORNA_SETUP_TOKEN` env var (min. 16 chars), or a
random token printed to the PocketBase log at startup:

```bash
docker compose logs pocketbase | grep STJORNA_SETUP_TOKEN
```

The bootstrap route refuses once a superuser exists or setup has completed, so it can never mint an
extra admin later.

## Next

- [Installation](/docs/installation/) for production deployments and the Helm chart.
- [Configuration](/docs/configuration/) for environment variables and options.
