# PocketBase Schema & Test Analysis

## Overview

Critical review of the PocketBase backend for STJÓRNA — schema definitions in `setup.ts` lines 79–206, and integration tests across 7 test files.

---

# Part 1: Schema Analysis

## Collections

### 1. `tenants` — base
| Field | Type | Issues |
|-------|------|--------|
| name | text, required | OK |
| slug | text, required | **No unique constraint** — duplicate slugs cause routing conflicts |
| plan | select (free/starter/professional/enterprise) | OK |
| custom_domain | text | OK |
| theme_config | json (max 2MB) | OK |
| **Missing: created/updated** | autodate | PocketBase adds these implicitly, fine |

### 2. `categories` — base
| Field | Type | Issues |
|-------|------|--------|
| tenant | text, required | **No relation type**, no index |
| name | text, required | OK |
| slug | text, required | **No unique constraint per tenant** |
| description | text | OK |
| active | bool | OK |
| sort_order | number | OK |

### 3. `products` — base
| Field | Type | Issues |
|-------|------|--------|
| tenant | text, required | **No relation type**, no index |
| category | text | **SHOULD BE `relation` to categories** — treated as relation ID in tests but schema says text |
| name | text, required | OK |
| slug | text, required | **No unique constraint per tenant** |
| price | number | OK |
| description | editor | OK |
| images | file (max 99, 10MB, jpeg/png/webp/gif) | OK, but no tests for file uploads |
| active | bool | OK |
| sort_order | number | OK |
| custom_fields | json (max 2MB) | OK |

### 4. `media` — base
| Field | Type | Issues |
|-------|------|--------|
| tenant | text, required | **No relation type** |
| filename | text, required | OK |
| original_name | text | OK |
| mime_type | text | OK |
| size | number | OK |
| width | number | OK |
| height | number | OK |
| s3_key | text | OK |
| s3_url | url | OK |
| thumbnail_url | url | OK |
| usage_count | number | OK |
| createdUser | text | **SHOULD BE `relation` to users** — test tries expand, will fail |

### 5. `product_media` — base (many-to-many join)
| Field | Type | Issues |
|-------|------|--------|
| tenant | text, required | OK |
| product | text, required | **No relation, no unique constraint on (product, media)** |
| media | text, required | **No relation** |
| sort_order | number | OK |

### 6. `embed_configs` — base
| Field | Type | Issues |
|-------|------|--------|
| tenant | text, required | **No relation** |
| name | text, required | OK |
| embed_code | text | OK |
| allowed_domains | json (max 2MB) | OK |
| active | bool | OK |

### 7. `analytics_events` — base
| Field | Type | Issues |
|-------|------|--------|
| tenant | text, required | **No relation, no index** |
| media | text | No relation |
| product | text | No relation |
| embed_config | text | No relation |
| domain | text | OK |
| referer | text | OK |
| client_ip | text | OK |
| user_agent | text | OK |
| timestamp | date | **High volume — consider indexing strategy** |

### 8. `webhooks` — base
| Field | Type | Issues |
|-------|------|--------|
| tenant | text, required | **No relation** |
| name | text, required | OK |
| url | url, required | OK |
| events | json (max 2MB) | **No validation of event names** — should use select with maxSelect:0 or JSON schema |
| secret | text | OK |
| active | bool | OK |

### 9. `api_keys` — base
| Field | Type | Issues |
|-------|------|--------|
| tenant | text, required | **No relation** |
| name | text, required | OK |
| key_hash | text, required | OK |
| permissions | json (max 2MB) | OK |
| last_used | date | OK |
| expires | date | **No cleanup automation for expired keys** |

### 10. `settings` — base
| Field | Type | Issues |
|-------|------|--------|
| tenant | text, required | **Should be unique per tenant** |
| config_json | json (max 2MB) | OK |

---

## Schema — Missing Features

| Issue | Severity | Impact |
|-------|----------|--------|
| No indexes on `tenant` field | **High** | Full table scans on every multi-tenant query |
| `category` should be `relation` type | **High** | No referential integrity; orphaned references |
| `createdUser` should be `relation` type | **High** | Test expects relation features, will break |
| No unique constraints on `slug` | **Medium** | Duplicate slugs break URL routing |
| No composite unique on `(product, media)` | **Medium** | Duplicate product-media links possible |
| `analytics_events` no index on timestamp | **Medium** | Slow queries on high-volume event data |
| `webhooks.events` unvalidated JSON | **Low** | Can set invalid event names |
| `settings` no unique per tenant | **Low** | Multiple config rows per tenant possible |
| No `.webp` in products.images mimeTypes | **Low** | WebP images rejected despite being standard |

---

# Part 2: Test Analysis

## Overall Assessment

**Score: 4/10**

Tests verify basic CRUD operations work against a live PocketBase instance, but have fundamental design flaws.

---

## Critical Issues

### 1. Tests Are Not Isolated (HIGH)
- `beforeAll` creates shared state (tenants, categories, products)
- Tests mutate this shared state (update, delete)
- `beforeEach` only clears `authStore`, never cleans up data
- **Test execution order matters** — flaky by design
- The `test:sequential` npm script acknowledges this (package.json line 10)

### 2. Security Model Untested (HIGH)
- **No tests for PocketBase API Rules** — this IS the security layer for multi-tenancy
- `multitenant.test.ts:98-109` test "should not be able to update tenant B using tenant A's ID" **expects the update to succeed** (line 108 assertion). This proves there is zero isolation enforcement at the API level.
- Real multi-tenancy requires per-collection API rules (e.g., `@request.auth.tenant = tenant`), but these rules are neither defined in schema nor tested

### 3. `createdUser` Test Will Fail (MEDIUM)
- `media.test.ts:139-147` uses `expand: 'createdUser'` 
- Schema defines `createdUser` as `type: 'text'`, not a relation
- Expand only works on relation fields — will return null or throw

### 4. Auth Tests Are Redundant (MEDIUM)
- `auth.test.ts` tests PocketBase's built-in admin auth
- These test the framework, not the application code
- Belongs in a smoke test, not as primary test content

---

## Missing Test Coverage

| Area | What's Missing |
|------|---------------|
| **API Rules** | No tests verify that tenant users can only see their own data |
| **Tenant User Auth** | No tests for `users` collection auth |
| **File Uploads** | `products.images` file field never tested |
| **product_media** | Join collection completely untested |
| **embed_configs** | Entire collection untested |
| **analytics_events** | Entire collection untested |
| **api_keys** | Entire collection untested (only fixture exists) |
| **settings** | Entire collection untested |
| **S3 Integration** | S3 mocks exist but no tests use them |
| **Webhook Delivery** | Only CRUD on webhook records, no delivery testing |
| **Input Validation** | No tests for required field rejection, type enforcement |
| **Pagination** | No edge cases (page overflow, sort) |
| **Race Conditions** | No concurrent operation tests |
| **Schema Validation** | No tests that verify field constraints |

---

## Test File Breakdown

### `auth.test.ts`
**Issues:** Tests PocketBase framework internals, not application code. Sequential re-auth test (line 77) reuses same credentials, not actually "different users."

### `multitenant.test.ts`
**Issues:** The cross-tenant "prevention" test (line 98-109) **expects the operation to succeed**, proving no security exists. Tests only admin context, never tenant user context. Shared beforeAll data.

### `collections/tenants.test.ts`
**Issues:** Creates fixtures with random names in beforeAll, never cleans up. No plan validation tests.

### `collections/categories.test.ts`
**Issues:** No negative filtering test (tenant B should not see tenant A data). No required-field rejection test. No unique slug enforcement test.

### `collections/products.test.ts`
**Issues:** `category` field tested with relation ID but schema is text type. No file upload testing despite `images` being a file field. No custom_fields type validation.

### `collections/media.test.ts`
**Issues:** `createdUser` test (line 139-147) uses expand on a text field — will fail. No S3 upload integration testing despite S3 mocks existing.

### `webhooks.test.ts`
**Issues:** No webhook delivery testing, only CRUD on records. No event validation (can set any string).

---

## Test Infrastructure Issues

### Dependency on Podman
- Requires local container runtime
- No CI fallback (Testcontainers, SQLite in-memory)
- Container startup adds 30+ seconds to test run
- `beforeAll` timeout of 60s (generous, but fragile)

### Non-deterministic Fixtures
- `generateId()` uses `Math.random()` — hard to reproduce failures
- Random prices, sizes, IDs make debugging harder

### No Parallel Safety
- Shared container state means tests cannot run in parallel
- Sequential execution acknowledged in package.json
- Long test suite will scale poorly

---

## Summary Verdict

| Area | Score | Reasoning |
|------|-------|-----------|
| **Schema Design** | 6/10 | Functional core, missing indexes, relations, constraints |
| **Security Model** | 2/10 | No API rules tested, no isolation enforcement |
| **Test Coverage** | 4/10 | CRUD basics covered, critical paths untested |
| **Test Quality** | 3/10 | Not isolated, flaky, framework-testing |
| **Infrastructure** | 5/10 | Works locally, not CI-ready |

**Priority Fixes:**
1. Add PocketBase API rules to every collection for multi-tenant isolation
2. Convert `category`, `createdUser` to relation types
3. Add unique indexes on `slug` (per tenant) and composite unique on `(product, media)`
4. Rewrite tests with proper isolation (cleanup per test)
5. Test API rules with multiple auth contexts
6. Add indexes on `tenant` fields for performance
