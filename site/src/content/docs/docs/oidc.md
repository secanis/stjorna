---
title: OIDC / SSO
description: Map an identity provider's groups to tenants and roles.
---

STJÓRNA supports single sign-on via any OpenID Connect (OIDC) provider.

## Setup

A superuser registers the provider under **Settings → OIDC**. The provider is added as a PocketBase
OAuth2 provider on the `users` collection; the client secret is stored only there.

On every OIDC login, a hook maps the configured groups claim to tenant memberships and roles. The
relevant options:

- `oidc_group_claim` — the claim containing the user's groups.
- `oidc_group_prefix` — an optional prefix to strip from group names.
- `oidc_role_mapping` — how groups map to `viewer` / `editor` / `admin` roles.
- `oidc_sync_mode` — how memberships are kept in sync on login.

Password login can be disabled for users when SSO is the only intended path.

## Provisioning

Users are created or matched on first login, then assigned memberships based on their groups. There
is no public sign-up; a user who does not match any configured group gets no tenant access.
