# SDD ledger — plan: .opencode/plans/2026-11-27-media-integration-docs.md

Task 0: complete — demo media URLs now use `pb.files.getToken()` + `?token=` (mirrors `frontend/src/utils/mediaUrl.ts`); README corrected (0.28 SDK, file-token flow). Verified: SDK `getURL()` output includes `?thumb=`+`?token=`, vite build green.

Ruling (Task 0): `demo/` has no test framework; verified the URL builder against the SDK's `getURL()` behavior + a clean `vite build` instead of adding vitest (out of plan scope). Cost if wrong: a future refactor could regress URL building unnoticed — the same logic is covered by `frontend/src/utils/mediaUrl.ts` and Task 1b/3 acceptance.
