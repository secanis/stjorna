---
title: Configuration
description: Environment variables and instance options for STJÓRNA.
---

Configuration is split between environment variables (for the PocketBase container) and the
PocketBase admin GUI (for storage, OIDC, SMTP and API keys).

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `PB_SECRET` | Yes | Encryption key for PocketBase's internal data. **Exactly 32 ASCII chars.** |
| `PB_SUPERUSER_EMAIL` | With password | First superuser email, created headlessly on first boot. |
| `PB_SUPERUSER_PASSWORD` | With email | First superuser password (min. 8 chars; no placeholders). |
| `PB_SUPERUSER_IPS` | No | Space-separated IPs/CIDRs allowed to log in as superuser. |
| `STJORNA_SETUP_TOKEN` | No | Fixed one-time token for the wizard's "create superuser" route (min. 16 chars). |
| `PB_AUTOMIGRATE` | No | Only controls generating migration files from dashboard edits (Compose defaults `true`). |
| `STJORNA_LOG_OTP` | No | Dev-only: log superuser OTP codes to stdout when SMTP is absent. |

## `PB_SECRET`

PocketBase uses `PB_SECRET` directly as the AES-256 key, so it must be exactly 32 ASCII characters.
A 64-character hex value (from `openssl rand -hex 32`) would silently disable encryption — the
container refuses to start in that state.

Generate a fresh key:

```bash
openssl rand -hex 16
# alternative without openssl:
LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32
```

:::caution
`PB_SECRET` is immutable in practice. Changing it means the encrypted data (including S3 settings)
can no longer be decrypted — effectively a factory reset.
:::

## Superuser bootstrap

Set both `PB_SUPERUSER_EMAIL` **and** `PB_SUPERUSER_PASSWORD` to create the first superuser
non-interactively. The container refuses to start when the email is set but the password is empty,
shorter than 8 characters, or a placeholder such as `changeme`.

Leave both unset to create the superuser through the `/setup` wizard instead.

## Superuser IP allowlist

`PB_SUPERUSER_IPS` (space-separated IPs/CIDRs) limits superuser logins. Docker Compose defaults to
loopback + private ranges:

```
127.0.0.1 ::1 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16
```

`0.0.0.0/0` disables the check. Behind an ingress, PocketBase sees the proxy's IP unless its
trusted-proxy settings are configured.

## Storage, OIDC, SMTP, API keys

These are configured in the admin GUI, **not** via environment variables:

- **Storage** — see [Storage](/docs/storage/).
- **OIDC / SSO** — see [OIDC / SSO](/docs/oidc/).
- **API keys** — see [API keys](/docs/api-keys/).
