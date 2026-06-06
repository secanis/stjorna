import PocketBase from 'pocketbase';
import { getPb, getTestAdminCredentials } from '../setup.ts';

export async function createAdminClient(): Promise<PocketBase> {
  const pb = getPb();
  const { email, password } = getTestAdminCredentials();
  await pb.admins.authWithPassword(email, password);
  return pb;
}

export async function createTenantClient(tenantId: string): Promise<PocketBase> {
  const pb = getPb();
  const adminClient = await createAdminClient();

  const result = await adminClient.collection('tenants').getList(1, 1);
  const tenant = result.items[0];

  const email = `user-${tenantId}@stjorna.test`;
  const password = 'testpassword123456';

  try {
    await adminClient.collection('users').create({
      email,
      password,
      passwordConfirm: password,
      tenant: tenantId,
      name: `Test User for ${tenantId}`,
    });
  } catch {
  }

  await pb.collection('users').authWithPassword(email, password);

  return pb;
}

export function getUnauthenticatedClient(): PocketBase {
  return new PocketBase(getPb().baseUrl);
}

export function as<T extends PocketBase>(pb: T): T {
  return pb;
}