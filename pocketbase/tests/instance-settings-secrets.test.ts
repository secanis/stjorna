import { describe, it, expect, beforeAll } from 'vitest';
import PocketBase from 'pocketbase';
import { createAdminClient } from './helpers/client.ts';

/**
 * T-07.1: instance_settings must not be able to hold plaintext secrets.
 *
 *   - Migration 1770001300 hid s3_secret_key / s3_access_key /
 *     oidc_client_secret and scrubbed their values, but kept the columns,
 *     and the frontend kept writing to them on every wizard run / OIDC
 *     save.
 *   - Migration 1770001600 DROPS the columns. The frontend no longer sends
 *     them, and PB silently ignores unknown keys, so even an old client
 *     that still posts `s3_secret_key` cannot put a plaintext copy into
 *     the database. The S3 credentials live only in PocketBase's own
 *     (PB_SECRET-encrypted) settings and the OIDC secret only on the
 *     `users` collection's oauth2 provider config.
 *
 * Acceptance (improvements.md follow-up T-07.1): "an instance_settings row
 * has empty secret fields after setup + OIDC save".
 */

const SECRET_KEYS = ['s3_secret_key', 's3_access_key', 'oidc_client_secret'];
const CANARY_VALUES = ['SECRET-CANARY-X', 'SECRET-CANARY-Y', 'SECRET-CANARY-Z'];

describe('T-07.1: instance_settings cannot store plaintext secrets', () => {
  let pb: PocketBase;

  beforeAll(async () => {
    pb = await createAdminClient();
  });

  it('the three secret columns no longer exist on instance_settings', async () => {
    const coll = await pb.collections.getOne('instance_settings');
    for (const k of SECRET_KEYS) {
      const f = coll.fields.find((x: any) => x.name === k);
      expect(f, `field ${k} must have been dropped (migration 1770001600)`).toBeUndefined();
    }
  });

  it('writing the old secret keys (setup wizard / OIDC save shape) leaves the row without them', async () => {
    // The exact payload shapes the pre-T-07.1 frontend used to send.
    const created = await pb.collection('instance_settings').create({
      instance_name: 't07-canary-' + Date.now(),
      storage_type: 's3',
      s3_bucket: 'canary-bucket',
      s3_access_key: CANARY_VALUES[1],
      s3_secret_key: CANARY_VALUES[0],
      oidc_enabled: true,
      oidc_client_id: 'canary-client',
      oidc_client_secret: CANARY_VALUES[2],
    });
    expect(created.id).toBeTruthy();

    const row = await pb.collection('instance_settings').getOne(created.id);
    for (const k of SECRET_KEYS) {
      expect((row as any)[k], `${k} must not be stored`).toBeUndefined();
    }
    expect(JSON.stringify(row)).not.toContain('SECRET-CANARY');

    // Same for an update of an existing row.
    const updated = await pb.collection('instance_settings').update(created.id, {
      s3_secret_key: CANARY_VALUES[0],
      oidc_client_secret: CANARY_VALUES[2],
    });
    expect(JSON.stringify(updated)).not.toContain('SECRET-CANARY');

    // Nothing in the whole collection carries a canary.
    const all = await pb.collection('instance_settings').getFullList();
    expect(JSON.stringify(all)).not.toContain('SECRET-CANARY');
  });
});
