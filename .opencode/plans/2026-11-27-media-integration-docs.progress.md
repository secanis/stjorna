# SDD ledger — plan: .opencode/plans/2026-11-27-media-integration-docs.md

Task 0: complete — demo media URLs now use `pb.files.getToken()` + `?token=` (mirrors `frontend/src/utils/mediaUrl.ts`); README corrected (0.28 SDK, file-token flow). Verified: SDK `getURL()` output includes `?thumb=`+`?token=`, vite build green.

Ruling (Task 0): `demo/` has no test framework; verified the URL builder against the SDK's `getURL()` behavior + a clean `vite build` instead of adding vitest (out of plan scope). Cost if wrong: a future refactor could regress URL building unnoticed — the same logic is covered by `frontend/src/utils/mediaUrl.ts` and Task 1b/3 acceptance.

Task 3: complete — backend (migration 1780002000 `media.public`, route `GET /api/stjorna/media/{id}/file` serving only public files via `$app.newFilesystem().serve()` + lazy `?thumb=`; registered in routes.js) + frontend (MediaEdit public toggle + copyable public URL, MediaList globe badge, i18n en/de/fr). Tests: `npx vitest run tests/media-public.test.ts` → 6/6; frontend `npx vitest run` → 44/44; `tsc` + `lint` clean; `check:hooks` → 16/16.

Ruling (Task 3): chose the custom-route approach (keep `media.file protected: true`, T-08 intact) over unprotecting the field. Serving bytes via `fsys.serve(e.response, e.request, …)` — verified working against the real PB container. Cost if wrong: none observed (tests green); the unprotect alternative would have reversed a documented security invariant.

Task 1b: complete — `site/src/content/docs/docs/embedding-media.md` (storefront + public-embed flows), sidebar entry, cross-links from api-keys/storage/README. `npm run build` → 13 pages, `/docs/embedding-media/` generated.

Task 1a: complete — `/developers` page (base URL pre-filled, copyable snippets, links), route + sidebar entry (editor/admin/pb_admin), i18n en/de/fr, e2e smoke test `developers.spec.ts`. `tsc` + `lint` clean; unit 44/44.

Task 2: complete — SDK decision (deferred) + public-embed mechanism recorded in `.opencode/improvements.md`.

Final review: dispatched a fresh-context reviewer. 1 Important + 5 Minor, all addressed in one fix pass (commit c0fd2ac):
- #1 Important (docs: `tenantId` → `tenant`) — fixed in embedding-media.md + api-keys.md.
- #2 re-graded Important (publicUrl() relative in same-origin) — fixed via `window.location.origin` fallback.
- #3 re-graded Important (public checkbox ignored on create) — fixed by hiding it until `isEditing()`.
- #4 Minor (multipart bool coercion) — RESOLVED by test `multipart update with public="false" un-publishes` (PB coerces "false"→false; no code change).
- #5 Minor (stale pre-T-08 share buttons) — fixed by removing them.
- #6 Minor (?thumb path traversal hardening) — fixed via `^\d+x\d+[tbf]?$` validation.

No deferred minors, no unfixed findings. Full backend suite 28 files / 278 tests green; frontend unit 44/44 + tsc/lint clean; site + demo builds green; check:hooks 16/16.



