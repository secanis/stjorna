import PocketBase from 'pocketbase';
import { getPb, getTestAdminCredentials } from '../setup.ts';

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

  try {
    await adminClient.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      tenant: tenantId,
      name: `User for tenant ${tenantId}`,
      role,
    });
  } catch {
  }

  const pb = new PocketBase(getPb().baseUrl);
  await pb.collection('users').authWithPassword(email, password);

  return { pb, email, password };
}

export async function createTenantClient(tenantId: string): Promise<PocketBase> {
  const { pb } = await createTenantUser(tenantId);
  return pb;
}