---
title: Embedding media & images
description: Serve STJÓRNA images and media on an external website — either a full storefront via API keys, or a single public file URL.
---

STJÓRNA has two ways to put images and media on an external website, depending on
what you need:

| Need | Mechanism | Auth |
| --- | --- | --- |
| A full storefront (categories, products, media) | API key → short-lived JWT → collection API | read-only, per tenant |
| A single image/video embedded on a page | Public file URL | none (opt-in per file) |

Both are read-only. Media files are **protected by default**: the normal file
endpoint needs a short-lived *file token*, so a plain `<img>` to
`/api/files/media/…` will not load.

## A. Storefront (full catalog)

This is the flow the [`demo/`](https://github.com/secanis/stjorna/tree/main/demo)
app in the repo uses. Four steps:

### 1. Issue an API key

A superuser issues a key in the admin GUI (**API Keys**) or via the API:

```bash
curl -X POST https://pb.example.com/api/stjorna/api-keys \
  -H "Authorization: <superuser-token>" \
  -H "Content-Type: application/json" \
  -d '{"tenant": "<tenant-id>", "name": "storefront"}'
```

The plaintext key (`stjorna_<tenant>_<key>.<secret>`) is returned **exactly
once** — store it as a secret. See [API keys](/docs/api-keys).

### 2. Exchange the key for a short-lived JWT

```bash
curl -X POST https://pb.example.com/api/stjorna/api-keys/exchange \
  -H "Authorization: Bearer stjorna_<tenant>_<key>.<secret>"
```

This returns a JWT valid for **1 hour**, scoped to one tenant as a `viewer`.
Re-exchange before it expires.

### 3. Read collections (with media)

Use the JWT as a normal PocketBase auth token:

```bash
curl "https://pb.example.com/api/collections/products/records?expand=media" \
  -H "Authorization: <jwt>"
```

`expand=media` fills each product with its media records — but only when the
request is authenticated.

### 4. Build media URLs with a file token

Media files need a **file token** (different from the JWT), fetched via the
PocketBase SDK's `pb.files.getToken()` and appended as `?token=`:

```js
import PocketBase from 'pocketbase';

const pb = new PocketBase('https://pb.example.com');
pb.authStore.save(jwt, null); // the JWT from step 2

const products = await pb.collection('products').getList(1, 50, {
  expand: 'media',
});

const fileToken = await pb.files.getToken(); // POST /api/files/token

for (const p of products.items) {
  for (const media of p.expand?.media ?? []) {
    const src = pb.files.getURL(media, media.file, {
      thumb: '300x300',
      token: fileToken,
    });
    // <img src={src} />
  }
}
```

Notes:

- Never put the auth **JWT** in a URL — it leaks into logs and history. Use the
  short-lived **file token** only.
- The file token is valid ~1 hour; refresh it ~5 minutes before expiry.
- `?thumb=300x300` returns a thumbnail (images only; other files return the
  original).

## B. Single-file embed (public URL)

For a one-off image — a logo, a hero image, a product shot on a marketing page —
mark the media **public** and use its stable, token-free URL.

1. In the STJÓRNA admin UI, open the media item and tick **Public**.
2. Copy the **Public URL** shown below the checkbox:

   ```
   https://pb.example.com/api/stjorna/media/<media-id>/file
   ```

3. Use it directly, no auth:

   ```html
   <img src="https://pb.example.com/api/stjorna/media/<media-id>/file?thumb=300x300" />
   ```

Public files are readable by **anyone with the link** — intended for
public-facing assets, opt-in per file. Files left non-public stay protected.

## Reference

- [`demo/`](https://github.com/secanis/stjorna/tree/main/demo) — a small SolidJS
  storefront that runs the full storefront flow above.
- [API keys](/docs/api-keys) — issuing, exchanging, and revoking keys.
- [Storage](/docs/storage) — where files live (local or S3).
- [API reference](/docs/api) — the OpenAPI spec, including
  `GET /api/stjorna/media/{id}/file`.
