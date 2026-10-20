# STJÓRNA API Keys

This file used to hold the original API-key design notes and open issues.
They described the first implementation (stored service-user passwords,
v0.22-era rules) and are obsolete: the open issues were resolved by the
API-key redesign (service user + `/exchange` token, migration
`1770001200_api_keys_v2.js`).

Current documentation:

- `README.md` → "Authentication & roles" → "API keys (machine access)"
- `pocketbase/pb_hooks/api_keys.pb.js` — header comment documents every
  route, the key format, hashing and the service-user model
- `pocketbase/tests/api-keys.test.ts`, `pocketbase/tests/api-keys-v2.test.ts`
  — the behaviour as tested
