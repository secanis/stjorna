---
title: Authentication & roles
description: Accounts, per-tenant roles and how access is enforced.
---

STJÓRNA has two kinds of accounts:

## PocketBase superusers

`_superusers` are **instance operators**. They sign in to the STJÓRNA admin GUI (and PocketBase's
own `/_/` UI) and manage tenants, users, memberships, instance settings (OIDC, SMTP, storage) and
API keys.

- Superuser logins use **MFA (email OTP)** once SMTP is configured.
- Logins can be limited to IP ranges with `PB_SUPERUSER_IPS`.
- The first superuser comes from `PB_SUPERUSER_EMAIL` / `PB_SUPERUSER_PASSWORD` or the setup wizard.

## Users

`users` are **tenant members**. There is no public sign-up — users are created by a superuser or
provisioned by OIDC.

Access to tenant data is granted per tenant through `user_tenants` (user, tenant, role) rows:

| Role | Products / categories / media | Tenant members |
|---|---|---|
| `viewer` | read | — |
| `editor` | read, create, update | — |
| `admin` | read, create, update, delete | manage `user_tenants` |

:::tip
These rules are enforced by the collection API rules, **not only by the UI**. A `viewer` token
cannot mutate data through the REST API either.
:::

## OIDC / SSO

Configured by a superuser under **Settings → OIDC**. The provider is registered as a PocketBase
OAuth2 provider on the `users` collection. On every OIDC login, a hook maps the configured groups
claim to tenant memberships and roles. See [OIDC / SSO](/docs/oidc/).

## API keys (machine access)

API keys give a backend or storefront **read-only** access to one tenant, without a human user. See
[API keys](/docs/api-keys/).
