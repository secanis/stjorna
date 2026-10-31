---
title: Overview
description: What STJÓRNA is and how it fits together.
---

STJÓRNA is an open-source, **multi-tenant product management** platform. It keeps products,
categories and media cleanly separated per tenant, exposes a read-only REST API for storefronts and
backends, and ships as a single Helm chart or a two-service Docker Compose stack.

## Stack

| Layer | Technology |
|---|---|
| Frontend | SolidJS + TypeScript + TailwindCSS, built with Vite |
| Backend | [PocketBase](https://pocketbase.io/) v0.40 with JavaScript VM hooks (`pb_hooks/*.pb.js`) |
| Storage | Local filesystem or any S3-compatible bucket (AWS S3, Cloudflare R2, Backblaze B2, MinIO, …) |
| Deployment | Helm chart (Kubernetes) or Docker Compose |
| API | Auto-generated OpenAPI 3.0 with a bundled Swagger UI |

## Core concepts

- **Tenants** are first-class. Products, media and categories are scoped to a tenant, and the
  isolation is enforced by the collection API rules — not just the UI.
- **Two account kinds**: PocketBase *superusers* (instance operators) and *users* (tenant members,
  no public sign-up).
- **Roles per tenant** — `viewer`, `editor`, `admin` — decide what a member can read and write.
- **Read-only API keys** give a backend or storefront machine access to exactly one tenant.

## Screenshots

![Dashboard overview with tenant selector](/screenshot-1.png)

![Statistics information for each tenant](/screenshot-2.png)

![STJÓRNA settings and tenant configuration](/screenshot-3.png)

## Where to go next

- [Getting started](/docs/getting-started/) — spin it up and run the setup wizard.
- [Installation](/docs/installation/) — Docker Compose or Helm, in detail.
- [Authentication & roles](/docs/auth-roles/) — accounts, roles and the access model.
- [API reference](/docs/api/) — the live OpenAPI spec in Swagger UI.
