# Plan: Media integration documentation & SDK discussion

**Date:** 2026-11-27 (updated 2026-11-28)
**Status:** Decisions locked — ready to execute
**Owner:** Matthias (assignee `matthiasbaldi`)

## Intent

STJÓRNA has no documentation — neither in the admin app nor on the docs site —
explaining how to integrate its images and media into an external website. This
plan closes that gap (1a in-app, 1b docs site), fixes the stale reference
example it depends on, records a decision on the JS/npm SDK idea (2), and adds
an opt-in public-embed path for individual media files.

## Findings (verified against the code)

1. **No integration guide exists.** The docs site (`site/src/content/docs/`)
   covers api-keys, auth, OIDC, storage — but nothing on media URLs, the file
   token, or thumbnails. The admin app has `/api-docs` (Swagger) and
   `/api-keys`, but no "how do I put my media on my website" page.

2. **Media files are `protected` (T-08).** Serving one requires a short-lived
   **file token** — `pb.files.getToken()` → `POST /api/files/token`, ~1 h TTL —
   appended as `?token=`. The auth JWT in the URL is the *wrong* token type and
   was deliberately removed. So there is **no static hotlink** today: a public
   page cannot use a plain `<img src="/api/files/media/{id}/{file}">`.

3. **The demo app is stale.** `demo/src/lib/pb.ts` builds media URLs with
   `pb.files.getUrl()`, which in SDK `0.28.1` appends **no token** — images
   will 401 against the protected-file backend. Its README also still says
   "pocketbase 0.21 SDK" (it is actually `^0.28.1`). The correct reference is
   the admin app's own `frontend/src/utils/mediaUrl.ts`.

4. **An in-app seam already exists.** `utils/mediaUrl.ts` has a pending
   follow-up: the admin "share" buttons predate T-08 and need redesign ("a
   token URL is not a share URL — it expires").

## Goals / non-goals

**Goals**

- A correct, tested "integrate media into your website" guide in two places:
  the docs site (1b) and a new in-app "Developers" page (1a).
- Fix `demo/` so it is a working reference again, and link it from the docs.
- An opt-in `public` flag on media, so individual files can be embedded on
  public pages with a stable, token-free URL (build now).
- A written SDK decision (2): options, recommendation, go/no-go (no build).

**Non-goals**

- No SDK package is built (part 2 is a decision only).

## Decisions

### Decision 1 — public embed mechanism → **A: opt-in `public` flag (build now)**

A new `public` boolean on the `media` collection. Files marked public get a
stable, token-free URL; everything else stays `protected` (T-08 default). The
admin UI gets a "make public / copy link" action, retiring the stale share
button.

**Implementation choice (resolve during build):**
- **Preferred — public route**: `GET /api/stjorna/media/{id}/file` (registered
  in `lib/routes.js`) that serves only `public=true` files, supporting
  `?thumb=`. Keeps the `protected: true` field and its file-token semantics
  intact for everything else. Clean separation, minimal blast radius.
- **Alternative — unprotect the field**: set the file field to `protected:
  false` and gate with a `viewRule` that allows anonymous reads of `public`
  records. Simpler and PocketBase-native (thumbnails free), but relaxes T-08
  globally and touches the shared media access model.

### Decision 2 — JS/npm SDK → **defer (recorded)**

`demo/` stays the canonical, tested reference; the guide makes the ~40-line
integration copyable. Revisit if a second real storefront appears. Recorded in
`.opencode/improvements.md` so it is not re-litigated.

## Work breakdown

### Task 0 — Fix the demo reference (prerequisite)

- `demo/src/lib/pb.ts`: replace `pb.files.getUrl(...)` with a helper that calls
  `pb.files.getToken()` and appends `?token=` + `?thumb=` (mirror
  `frontend/src/utils/mediaUrl.ts`). Refresh the token ~5 min before expiry.
- `demo/README.md`: correct the SDK version ("0.28") and the media-URL row to
  describe the file-token flow, not `[&token=...]` auto-append.
- **Acceptance:** against a running protected-file backend, product images load
  in the demo after pasting an API key; no auth JWT appears in any URL.

### Task 3 — Public-embed feature (`public` flag)

- New migration (timestamp > `1780001000`): add `public` boolean to `media`,
  default `false`.
- Public read path (preferred: custom route in `lib/routes.js`) serving only
  `public=true` files, token-free, with `?thumb=` support.
- In-app: "make public / copy link" action on `MediaList`/`MediaEdit`,
  replacing the stale share button (i18n en/de/fr).
- **Acceptance:** public file serves 200 with correct content-type via the
  public URL; a `public=false` file returns 404/403; `?thumb=` works; negative
  test proves non-public files stay protected.

### Task 1b — Docs site guide

- New Starlight page `site/src/content/docs/docs/embedding-media.md`
  ("Embedding media & images"), added to the `Guides` sidebar group.
- Content: both use cases —
  1. Storefront: issue key → exchange → JWT → `getList({ expand: 'media' })` →
     file token → `<img>`/`<video>` with `thumb`; refresh cadence.
  2. Public embed: the `public` flag + stable URL from Task 3.
- Cross-link from `api-keys.md`, `storage.md`, and `README.md`'s API section.
- **Acceptance:** `npm run build` in `site/` passes; page reachable in the
  sidebar with working curl + JS snippets.

### Task 1a — In-app "Developers" page

- New route `/developers` + sidebar entry (icon, `nav.developers` label),
  visible to `editor`/`admin`/`pb_admin` like `/api-docs`.
- i18n strings for `en`/`de`/`fr`.
- Content mirrors the docs guide: copy-paste snippets, the tenant's real base
  URL pre-filled, link to the docs site + `demo/`, and the public-embed
  instructions from Task 3.
- **Acceptance:** page renders for all three roles, snippets are accurate,
  `npx tsc --noEmit` and `npm run lint` pass, and an e2e test visits the page.

### Task 2 — SDK decision (no build)

- Add the Decision 2 table + recommendation to `.opencode/improvements.md` as a
  recorded decision, with a trigger for revisiting ("second real storefront
  consumer").
- **Acceptance:** decision recorded; no package is created.

## Notes / constraints

- Do not reintroduce the auth-JWT-in-URL pattern (T-08 invariant). Any media
  URL must carry a file token from `pb.files.getToken()`, never `pb.authStore.token`.
- Any new route must be registered in `pb_hooks/lib/routes.js` (feeds
  `/api/openapi.json`) or `npm run check:hooks` fails.
- The `public` flag (Task 3) requires a **new migration** (timestamp >
  `1780001000`) and a negative test proving non-public files stay protected.
- Public files are readable by anyone with the URL — intended for
  marketing/public images, opt-in per file.
