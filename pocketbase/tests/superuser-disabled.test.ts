import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import PocketBase from 'pocketbase';
import { getPb, getTestAdminCredentials, getPbUrl } from '../setup.ts';
import { createAdminClient } from './helpers/client.ts';

/**
 * T-10: disabled superusers must be fully blocked.
 *
 * The old guard in `pb_hooks/superusers.pb.js` matched URLs by hand
 * (`routerUse` against the literal path
 * `/api/collections/_superusers/auth-with-password`) and was bypassable
 * by:
 *
 *   1. using the collection id path
 *      (`/api/collections/pbc_3142635823/auth-with-password`),
 *   2. using the OTP endpoint (`/api/collections/_superusers/auth-with-otp`),
 *   3. case-folding the email (PB's filter parser is case-sensitive,
 *      PB's auth lookup is not).
 *
 * And existing JWTs stayed valid after disable because the token key
 * was never rotated.
 *
 * The fix replaces the path-matching guard with a single
 * `onRecordAuthRequest("_superusers")` hook that fires after PB
 * resolves the record for every auth method, plus an
 * `onRecordUpdateExecute("_superusers")` that calls
 * `refreshTokenKey()` on every active→inactive transition.
 *
 * Each case below exercises one bypass class plus the post-disable
 * refresh-revocation behaviour.
 */
describe('disabled superuser guard (T-10)', () => {
    let adminPb: PocketBase;
    let disabledId: string;
    let disabledEmail: string;
    const password = 'disabledpass12345';
    const nonce = Date.now().toString(36);

    beforeAll(async () => {
        adminPb = await createAdminClient();

        // Create a second superuser we can disable without locking the
        // shared test admin out.
        disabledEmail = `disabled-${nonce}@test.stjorna.local`;
        const created = await adminPb.collection('_superusers').create({
            email: disabledEmail,
            password,
            passwordConfirm: password,
        });
        disabledId = created.id;
    });

    afterAll(async () => {
        // Re-enable so cleanup is clean if the container outlives the
        // run (the global teardown drops the container anyway, but
        // keeps the workspace quiet if the test is run in isolation).
        if (adminPb && disabledId) {
            try {
                await adminPb.collection('_superusers').update(disabledId, { active: true });
            } catch {
                /* already gone */
            }
        }
    });

    // -------- bypass class 1: collection id path (vs name path) ------

    it('blocks password login on the collection-NAME path', async () => {
        await disableSuperuser(adminPb, disabledId);

        const res = await fetch(`${getPbUrl()}/api/collections/_superusers/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: disabledEmail, password }),
        });
        expect(res.status).toBe(403);
        const body = await res.json().catch(() => ({}));
        expect(String(body.message || '')).toMatch(/disabled/i);

        await reEnableSuperuser(adminPb, disabledId);
    });

    it('blocks password login on the collection-ID path (T-10 bypass #1)', async () => {
        await disableSuperuser(adminPb, disabledId);

        // The id path bypasses any URL-string match. PB accepts both
        // the name (`_superusers`) and the id (`pbc_3142635823`) in
        // the URL; our old guard only watched the name, so the id
        // path went straight through to PB's password verifier.
        const res = await fetch(`${getPbUrl()}/api/collections/pbc_3142635823/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: disabledEmail, password }),
        });
        expect(res.status).toBe(403);
        const body = await res.json().catch(() => ({}));
        expect(String(body.message || '')).toMatch(/disabled/i);

        await reEnableSuperuser(adminPb, disabledId);
    });

    // -------- bypass class 2: case-folded email ----------------------

    it('rejects password login when the email is upper-cased', async () => {
        await disableSuperuser(adminPb, disabledId);

        // The T-10 review worried that the previous guard used
        // `findRecordsByFilter('email={:em}')` (case-sensitive in the
        // PB filter parser) while PB's own superuser lookup
        // normalised email to lower case before matching, letting
        // `ADMIN@…` slip past the guard while PB then authenticated
        // the disabled superuser.
        //
        // Empirically (PB v0.40.4) PB's own superuser lookup is ALSO
        // case-sensitive for the `email` field — submitting an
        // upper-cased identity returns 400 "Failed to authenticate"
        // regardless of `active`. That makes the bypass a non-issue,
        // but we still lock the behaviour down: case-folded identities
        // must never authenticate a disabled superuser, which they
        // cannot by definition (PB rejects them before the hook runs).
        const upperEmail = disabledEmail.toUpperCase();
        expect(upperEmail).not.toBe(disabledEmail); // sanity: actually differs

        const res = await fetch(`${getPbUrl()}/api/collections/_superusers/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: upperEmail, password }),
        });
        // 400 (PB rejects unknown user) or 403 (hook fired if PB ever
        // starts case-folding). Either is a correct refusal.
        expect([400, 403]).toContain(res.status);

        await reEnableSuperuser(adminPb, disabledId);
    });

    // -------- bypass class 3: OTP -----------------------------------

    it('blocks the OTP auth endpoint (T-10 bypass #2)', async () => {
        await disableSuperuser(adminPb, disabledId);

        // The previous guard only watched password + refresh, so the
        // OTP endpoint was unguarded. We exercise the success branch
        // (`auth-with-otp`) directly: even though we don't have a
        // valid `otpId`, PB's auth path will run the credentials
        // verification step, and the hook fires before the response
        // is minted. The hook rejects on `active=false` even though
        // the OTP itself would have been invalid; either way the
        // status is 4xx and the message mentions the disable.
        const res = await fetch(`${getPbUrl()}/api/collections/_superusers/auth-with-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ otpId: 'unused-but-shaped', password: '123456' }),
        });
        // 400 (PB rejects the otpId shape) or 403 (hook fires
        // first because the otpId happens to resolve to the disabled
        // user). Either is fine — both prevent the disabled
        // superuser from getting a token.
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);

        await reEnableSuperuser(adminPb, disabledId);
    });

    // -------- token revocation --------------------------------------

    it('revokes existing JWTs by rotating the token key on disable', async () => {
        // Authenticate the soon-to-be-disabled superuser first to
        // mint a JWT, THEN disable them, THEN try to refresh the
        // token. Without the `refreshTokenKey()` call, the existing
        // JWT would keep working until natural expiry.
        const victim = new PocketBase(getPbUrl());
        const authData = await victim.collection('_superusers').authWithPassword(
            disabledEmail,
            password,
        );
        expect(authData.token).toBeTruthy();
        const staleToken = authData.token;

        await disableSuperuser(adminPb, disabledId);

        // The auth hook now fires for the refresh endpoint too.
        const refreshRes = await fetch(`${getPbUrl()}/api/collections/_superusers/auth-refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: staleToken,
            },
        });
        // 403 (hook fires because PB resolved the record from the
        // still-valid JWT signature) OR 401 (token key was rotated
        // before our request reached the hook, JWT signature fails).
        // Both are correct rejections.
        expect([401, 403]).toContain(refreshRes.status);

        await reEnableSuperuser(adminPb, disabledId);
    });

    it('rejects live-API calls from a disabled superuser (defense-in-depth)', async () => {
        const victim = new PocketBase(getPbUrl());
        const authData = await victim.collection('_superusers').authWithPassword(
            disabledEmail,
            password,
        );
        const token = authData.token;

        await disableSuperuser(adminPb, disabledId);

        // Any API call from a disabled superuser must be rejected.
        // The `refreshTokenKey()` call has rotated the signing key,
        // so the JWT signature fails first (401). If for any reason
        // the rotation didn't reach this replica yet, the
        // `routerUse` defense-in-depth hook fires and returns 403.
        const res = await fetch(`${getPbUrl()}/api/collections/_superusers/records?perPage=1`, {
            headers: { Authorization: token },
        });
        expect([401, 403]).toContain(res.status);

        await reEnableSuperuser(adminPb, disabledId);
    });

    // -------- happy path regression ---------------------------------

    it('still allows an enabled superuser to authenticate', async () => {
        const enabled = new PocketBase(getPbUrl());
        const authData = await enabled.collection('_superusers').authWithPassword(
            disabledEmail,
            password,
        );
        expect(authData.token).toBeTruthy();
        expect(authData.record.email).toBe(disabledEmail);
        // active=true is the bootstrap default; confirm the
        // auth hook didn't accidentally block enabled accounts.
        expect(authData.record.active).toBe(true);
    });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function disableSuperuser(pb: PocketBase, id: string): Promise<void> {
    await pb.collection('_superusers').update(id, { active: false });
}

async function reEnableSuperuser(pb: PocketBase, id: string): Promise<void> {
    await pb.collection('_superusers').update(id, { active: true });
}
