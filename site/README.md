# gh-pages site

This directory is the static site that gets pushed to the `gh-pages`
branch by the `publish-site` job in `.github/workflows/release.yml`.

The site is served at <https://secanis.github.io/stjorna/> and hosts:

- `index.html` — landing page with the "Add to Helm" snippet and a link to the API docs
- `docs/index.html` — Swagger UI for the live `/api/openapi.json` spec
- `openapi.json` — the spec, refreshed at every release from a live PB container
- `swagger-ui/` — vendored Swagger UI assets (bundle + CSS) so the docs work offline

## Develop locally

```bash
# Serve the site at http://localhost:8080
python3 -m http.server 8080 --directory site
```

The Swagger UI will load `./openapi.json` from disk, so no running PB is needed.

## Refresh swagger-ui assets

The vendored `swagger-ui-bundle.js` and `swagger-ui.css` come from the
`swagger-ui-dist` npm package used by the v3 frontend. After upgrading
`swagger-ui` in `frontend/package.json`, refresh them:

```bash
cp frontend/node_modules/swagger-ui-dist/swagger-ui-bundle.js site/swagger-ui/
cp frontend/node_modules/swagger-ui-dist/swagger-ui.css       site/swagger-ui/
```

The `.nojekyll` file is required because Swagger UI asset paths contain
dots (e.g. `swagger-ui-bundle.js`) which GitHub Pages' default Jekyll
processing would strip out.
