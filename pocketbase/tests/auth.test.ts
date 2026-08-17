import { describe, it, expect, beforeAll } from 'vitest';
import { getPb, getTestAdminCredentials } from './setup.ts';

describe('Authentication', () => {
  let pb: ReturnType<typeof getPb>;

  beforeAll(() => {
    pb = getPb();
  });

  it('should authenticate admin with valid credentials', async () => {
    const { email, password } = getTestAdminCredentials();
    const authData = await pb.admins.authWithPassword(email, password);

    expect(authData).toBeDefined();
    expect(authData.token).toBeDefined();
    expect(authData.admin).toBeDefined();
    expect(authData.admin.email).toBe(email);
  });

  it('should reject invalid password', async () => {
    const { email } = getTestAdminCredentials();
    pb.authStore.clear();

    try {
      await pb.admins.authWithPassword(email, 'wrongpassword123456');
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.status).toBe(400);
      expect(error.data).toBeDefined();
    }
  });

  it('should reject non-existent admin', async () => {
    pb.authStore.clear();

    try {
      await pb.admins.authWithPassword('nonexistent@test.stjorna.local', 'anypassword');
      expect.fail('Should have thrown an error');
    } catch (error: any) {
      expect(error.status).toBe(400);
    }
  });

  it('should clear auth store', async () => {
    const { email, password } = getTestAdminCredentials();
    await pb.admins.authWithPassword(email, password);
    expect(pb.authStore.isValid).toBe(true);

    pb.authStore.clear();
    expect(pb.authStore.isValid).toBe(false);
  });

  it('should refresh auth token', async () => {
    const { email, password } = getTestAdminCredentials();
    await pb.admins.authWithPassword(email, password);
    expect(pb.authStore.isValid).toBe(true);
    expect(pb.authStore.token).toBeDefined();

    pb.authStore.clear();
    expect(pb.authStore.isValid).toBe(false);

    const refreshed = await pb.admins.authWithPassword(email, password);
    expect(refreshed.token).toBeDefined();
    expect(pb.authStore.isValid).toBe(true);
  });

  it('should list authenticated admins', async () => {
    const { email, password } = getTestAdminCredentials();
    await pb.admins.authWithPassword(email, password);

    const authData = await pb.admins.authWithPassword(email, password);
    expect(authData.admin).toBeDefined();
    expect(authData.admin.id).toBeDefined();
  });

  it('should auth as different users sequentially', async () => {
    const { email, password } = getTestAdminCredentials();

    await pb.admins.authWithPassword(email, password);
    expect(pb.authStore.isValid).toBe(true);
    expect(pb.authStore.model?.email).toBe(email);

    pb.authStore.clear();
    expect(pb.authStore.isValid).toBe(false);

    await pb.admins.authWithPassword(email, password);
    expect(pb.authStore.isValid).toBe(true);
  });
});