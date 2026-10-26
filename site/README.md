# STJÓRNA site

The public site for STJÓRNA — a marketing landing page plus a documentation
area. Built with **Astro + Starlight + Tailwind CSS**, it is pushed to the
`gh-pages` branch by the `publish-site` job in `.github/workflows/release.yml`
and served at <https://stjorna.secanis.ch> (see `public/CNAME`).

## What's here

- `/` — the landing page (`src/pages/index.astro`): hero, feature grid, API
  tiers and install snippet.
- `/docs/` — the documentation (`src/content/docs/docs/`), themed by Starlight.
- `/api/` — a Swagger UI page (`src/pages/api.astro`) that loads the generated
  `openapi.json`.
- `/openapi.json` — the OpenAPI 3.0 spec, refreshed from a live PocketBase
  container at every release.
- `swagger-ui/` — vendored Swagger UI assets (bundle + CSS).

## Develop locally

```bash
cd site
npm install
npm run dev      # http://localhost:4321
```

For a production build:

```bash
npm run build    # outputs site/dist/
npm run preview  # serve the build locally
```

## How the release workflow builds it

The `publish-site` job in `release.yml`:

1. Checks out the release tag, installs Node 24, runs `npm ci` and `npm run
   build` in `site/` (→ `site/dist/`).
2. Boots the just-built PocketBase image and copies its `/api/openapi.json`
   into `site/dist/openapi.json`.
3. Replaces the `@@CHART_VERSION@@` placeholder in `site/dist/index.html` with
   the chart version derived from the release tag.
4. `rsync`s `site/dist/` onto the `gh-pages` branch (excluding the Helm
   `index.yaml` and `*.tgz` artifacts written by `release-helm`).

The landing page's "Install via Helm" snippet carries the `@@CHART_VERSION@@`
placeholder; it is only ever substituted at release time so the public site
never ships a stale version.

## Docs content

Documentation pages are Markdown under `src/content/docs/docs/`, mapped to
`/docs/...`. The sidebar is configured in `astro.config.mjs`. Starlight's
built-in UI strings live in `src/content/i18n/` (empty by default).

## Refresh swagger-ui assets

The vendored `swagger-ui-bundle.js` and `swagger-ui.css` in
`public/swagger-ui/` come from the `swagger-ui-dist` npm package used by the v3
frontend. After upgrading `swagger-ui` in `frontend/package.json`, refresh them:

```bash
cp frontend/node_modules/swagger-ui-dist/swagger-ui-bundle.js site/public/swagger-ui/
cp frontend/node_modules/swagger-ui-dist/swagger-ui.css       site/public/swagger-ui/
```

## Notes

- `public/.nojekyll` is required because Swagger UI asset paths contain dots
  that GitHub Pages' default Jekyll processing would strip out.
- `public/CNAME` pins the custom domain `stjorna.secanis.ch`.
