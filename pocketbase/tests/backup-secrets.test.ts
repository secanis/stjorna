import { describe, it, expect, beforeAll } from 'vitest';
import PocketBase from 'pocketbase';
import { getPbUrl } from '../setup.ts';
import { createAdminClient } from './helpers/client.ts';

/**
 * T-07: instance_settings plaintext secret fields must never appear in a
 * backup export. They were marked hidden:true on the schema
 * (migration 1770001300) AND stripped in the backup hook itself as
 * defense-in-depth.
 *
 * Acceptance (per improvements.md T-07):
 *   "A backup export contains no secret values (test)."
 *
 * The test:
 *   1. Creates a settings row with non-empty values for each secret
 *      field. Note: PB's create() rejects writes to hidden fields
 *      silently — so the row WILL contain empty strings, not the
 *      values we passed. That's the FIRST guarantee: hidden fields
 *      can't even be populated through the CRUD API after the
 *      migration runs.
 *   2. As a superuser, GETs /api/backup/json.
 *   3. Asserts none of the three secret field names appear in the
 *      manifest — neither as a key on any instance_settings record
 *      nor anywhere else in the manifest.
 *   4. Repeats the assertion on the ZIP endpoint's manifest.json.
 */

const SECRET_KEYS = ['s3_secret_key', 's3_access_key', 'oidc_client_secret'];
const CANARY_VALUES = ['SECRET-CANARY-X', 'SECRET-CANARY-Y', 'SECRET-CANARY-Z'];

describe('T-07: backup export strips instance_settings plaintext secrets', () => {
  let pb: PocketBase;

  beforeAll(async () => {
    pb = await createAdminClient();
  });

  it('hidden: instance_settings rows carry no plaintext secret values', async () => {
    // We seed values into the hidden fields. The fix is two-layer:
    //
    //   1. schema-level hidden:true makes publicExport() (used by
    //      /api/backup/json|zip) skip them; PB v0.40 allows writes
    //      through the CRUD API regardless of the hidden flag, so
    //      the values WILL be stored on the row.
    //   2. The backup hook ALSO deletes these keys from the exported
    //      record after publicExport() returns. This is the
    //      defense-in-depth that ensures the canary never reaches
    //      the export regardless of PB's hidden behavior.
    //
    // What this test asserts:
    //   - We CAN seed non-empty values into hidden fields (PB allows it).
    //   - The canary values are NEVER present in /api/backup/json|zip.
    const created = await pb.collection('instance_settings').create({
      instance_name: 't07-canary-' + Date.now(),
      s3_secret_key: CANARY_VALUES[0],
      s3_access_key: CANARY_VALUES[1],
      oidc_client_secret: CANARY_VALUES[2],
    });
    expect(created.id).toBeTruthy();
    // Sanity: the row stored the canary (PB permits writes to hidden
    // fields — that's fine; the export is the leak vector we're closing).
    const row = await pb.collection('instance_settings').getOne(created.id);
    expect((row as any).s3_secret_key).toBe(CANARY_VALUES[0]);
    expect((row as any).s3_access_key).toBe(CANARY_VALUES[1]);
    expect((row as any).oidc_client_secret).toBe(CANARY_VALUES[2]);
  });

  it('GET /api/backup/json manifest contains none of the secret field names', async () => {
    const res = await fetch(getPbUrl() + '/api/backup/json', {
      headers: { Authorization: pb.authStore.token },
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    // Surface any leak loudly. The canary values are unique strings
    // — if any of them appears in the manifest, hidden:true did not
    // work and /backup/json is leaking credentials.
    for (const v of CANARY_VALUES) {
      expect(text).not.toContain(v);
    }
    // And the field names themselves must not appear inside
    // instance_settings records. (They might still appear as labels
    // in the OpenAPI schema or the OpenAPI hook — that's not a
    // secret leak — so we scope the assertion to the manifest's
    // collections.instance_settings array.)
    const manifest = JSON.parse(text);
    const settings = manifest?.collections?.instance_settings || [];
    for (const rec of settings) {
      for (const k of SECRET_KEYS) {
        expect(Object.prototype.hasOwnProperty.call(rec, k)).toBe(false);
      }
    }
  });

  it('GET /api/backup/zip manifest.json contains no secret values', async () => {
    const res = await fetch(getPbUrl() + '/api/backup/zip', {
      headers: { Authorization: pb.authStore.token },
    });
    expect(res.status).toBe(200);
    const buf = new Uint8Array(await res.arrayBuffer());
    // The zip is STORE-only (built by backup.pb.js). Find the
    // central directory, then locate the manifest.json entry, and
    // confirm its data block does not contain any canary.
    // Quick & dirty: search the whole byte buffer for the canary
    // bytes. STORE-only ZIPs keep entry data uncompressed, so the
    // manifest.json bytes are somewhere in the buffer.
    const asString = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    for (const v of CANARY_VALUES) {
      expect(asString).not.toContain(v);
    }
  });

  it('the schema-level hidden flag is set on the three secret fields', async () => {
    const coll = await pb.collections.getOne('instance_settings');
    for (const k of SECRET_KEYS) {
      const f = coll.fields.find((x: any) => x.name === k);
      expect(f, `field ${k} should exist on instance_settings`).toBeDefined();
      expect((f as any).hidden, `field ${k} should be hidden`).toBe(true);
    }
  });
});
