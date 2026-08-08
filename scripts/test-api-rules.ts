import PocketBase from 'pocketbase';

const PB_URL = process.env.PB_URL || 'http://localhost:8090';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@stjorna.ch';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminPassword123!';
const USER_EMAIL = process.env.USER_EMAIL || 'user@test.stjorna.local';
const USER_PASSWORD = process.env.USER_PASSWORD || 'user12345678test';

async function main() {
  console.log('=== PocketBase API Rules Test ===\n');
  console.log(`Connecting to: ${PB_URL}\n`);

  const pb = new PocketBase(PB_URL);

  // Test 1: Health check
  console.log('1. Health check...');
  try {
    await pb.health.check();
    console.log('   ✓ PocketBase is running\n');
  } catch (e: any) {
    console.error(`   ✗ Health check failed: ${e.message}\n`);
    process.exit(1);
  }

  // Test 2: Admin auth
  console.log('2. Admin authentication...');
  try {
    const authData = await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log(`   ✓ Admin authenticated: ${ADMIN_EMAIL}\n`);
  } catch (e: any) {
    console.error(`   ✗ Admin auth failed: ${e.status} ${e.message}`);
    console.log('   (This is expected if using external PocketBase with different credentials)\n');
  }

  // Test 3: Check collection rules
  console.log('3. Checking collection rules...');
  try {
    const collections = await pb.collections.getFullList({ perPage: 200 });
    const interestingCols = ['roles', 'tenants', 'user_tenants', 'categories'];
    for (const col of collections) {
      if (interestingCols.includes(col.name)) {
        console.log(`\n   ${col.name}:`);
        console.log(`     listRule: ${col.listRule || '(null)'}`);
        console.log(`     viewRule: ${col.viewRule || '(null)'}`);
        console.log(`     createRule: ${col.createRule || '(null)'}`);
      }
    }
  } catch (e: any) {
    console.error(`   ✗ Failed to get collections: ${e.status} ${e.message}`);
  }

  // Test 4: User auth (if we have user credentials)
  console.log('\n4. User authentication...');
  let userId = '';
  try {
    pb.authStore.clear();
    const authData = await pb.collection('users').authWithPassword(USER_EMAIL, USER_PASSWORD);
    userId = authData.record.id;
    console.log(`   ✓ User authenticated: ${USER_EMAIL}\n`);
  } catch (e: any) {
    console.error(`   ✗ User auth failed: ${e.status} ${e.message}`);
    console.log('   (This is expected if user does not exist yet)\n');
  }

  if (!userId) {
    console.log('Skipping remaining tests - no user authenticated\n');
    return;
  }

  // Test 5: Get user_tenants with expand
  console.log('5. Testing user_tenants expand...');
  try {
    const utResult = await pb.collection('user_tenants').getList(1, 1, {
      filter: `user = "${userId}"`,
      expand: 'tenant,role',
    });

    if (utResult.items.length === 0) {
      console.log('   No user_tenants records found');
    } else {
      const ut = utResult.items[0];
      console.log(`   user_tenants ID: ${ut.id}`);
      console.log(`   tenant ID: ${ut.tenant}`);
      console.log(`   role ID: ${ut.role}`);
      console.log(`   expand: ${JSON.stringify(ut.expand)}`);

      if (!ut.expand || !ut.expand.tenant || !ut.expand.role) {
        console.log('   ✗ EXPAND FAILED - tenant or role not in expand');
      } else {
        console.log(`   ✓ Expand worked!`);
        console.log(`     tenant name: ${ut.expand.tenant?.name}`);
        console.log(`     role name: ${ut.expand.role?.name}`);
      }
    }
  } catch (e: any) {
    console.error(`   ✗ Failed: ${e.status} ${e.message}`);
  }

  // Test 6: Direct fetch of tenant
  console.log('\n6. Testing direct tenant fetch...');
  try {
    if (!utResult?.items?.[0]?.tenant) {
      console.log('   Skipped - no tenant ID from user_tenants');
    } else {
      const tenantId = utResult.items[0].tenant;
      const tenant = await pb.collection('tenants').getOne(tenantId);
      console.log(`   ✓ Got tenant: ${tenant.name} (${tenant.id})`);
    }
  } catch (e: any) {
    console.error(`   ✗ Failed: ${e.status} ${e.message}`);
  }

  // Test 7: Direct fetch of role
  console.log('\n7. Testing direct role fetch...');
  try {
    if (!utResult?.items?.[0]?.role) {
      console.log('   Skipped - no role ID from user_tenants');
    } else {
      const roleId = utResult.items[0].role;
      const role = await pb.collection('roles').getOne(roleId);
      console.log(`   ✓ Got role: ${role.name} (${role.id})`);
    }
  } catch (e: any) {
    console.error(`   ✗ Failed: ${e.status} ${e.message}`);
  }

  console.log('\n=== Test Complete ===');
}

main().catch(console.error);
