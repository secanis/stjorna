import PocketBase from 'pocketbase';
import { getPb, getTestAdminCredentials } from '../../setup.ts';

export async function createAdminClient(): Promise<PocketBase> {
  const pb = getPb();
  const { email, password } = getTestAdminCredentials();
  await pb.admins.authWithPassword(email, password);
  return pb;
}

export async function createTenantUser(
  tenantId: string,
  role: string = 'admin',
  uniqueSuffix: string = ''
): Promise<{ pb: PocketBase; email: string; password: string }> {
  const adminClient = await createAdminClient();

  const suffix = uniqueSuffix || Date.now().toString(36);
  const email = `user-${suffix}-${tenantId}@stjorna.test`;
  const password = 'testpassword123456';

  // The `users` collection in STJÓRN A is PB's built-in `_pb_users_auth_`;
  // it accepts email+password and that's it — every other field passed in
  // the create body is silently dropped. So we set role / tenant on the
  // `user_tenants` join row below instead, which is how STJÓRN A
  // actually tracks tenant membership in production.
  let userId = '';
  try {
    const created = await adminClient.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      name: `User for tenant ${tenantId}`,
    });
    userId = created?.id || '';
  } catch {
    // Could already exist (idempotent test runs). Look it up below.
  }
  if (!userId) {
    try {
      const found = await adminClient.collection('users').getFirstListItem(`email="${email}"`);
      userId = found?.id || '';
    } catch {
    }
  }

  if (userId) {
    // Idempotent: ignore duplicate errors on re-runs.
    try {
      await adminClient.collection('user_tenants').create({
        user: userId,
        tenant: tenantId,
        role,
      });
    } catch {
    }
    // last_tenant is STJÓRN A's tiebreaker for users in multiple tenants
    // (see auth.ts:switchTenant). The stats hook uses it the same way.
    try {
      await adminClient.collection('users').update(userId, { last_tenant: tenantId });
    } catch {
    }
  }

  const pb = new PocketBase(getPb().baseUrl);
  await pb.collection('users').authWithPassword(email, password);

  return { pb, email, password };
}

export async function createTenantClient(tenantId: string): Promise<PocketBase> {
  const { pb } = await createTenantUser(tenantId);
  return pb;
}