import PocketBase from 'pocketbase';

const PB_URL = process.env.PB_URL || 'http://localhost:8090';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@stjorna.ch';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'adminPassword123!';

async function main() {
  console.log('=== PocketBase Setup Fix ===\n');
  console.log(`Connecting to: ${PB_URL}\n`);

  const pb = new PocketBase(PB_URL);

  console.log('Authenticating as admin...');
  try {
    await pb.admins.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
    console.log('  ✓ Authenticated\n');
  } catch (e: any) {
    console.error(`  ✗ Auth failed: ${e.status} ${e.message}`);
    console.error('\nPlease set ADMIN_EMAIL and ADMIN_PASSWORD env vars');
    process.exit(1);
  }

  // Step 1: Fix rules for all collections
  console.log('Step 1: Updating collection rules...');
  const allCollections = await pb.collections.getFullList({ perPage: 200 });

  const ruleUpdates: Record<string, any> = {
    'roles': {
      listRule: '@request.auth.admin = true',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.admin = true',
      updateRule: '@request.auth.admin = true',
      deleteRule: '@request.auth.admin = true',
    },
    'tenants': {
      listRule: '',
      viewRule: '@request.auth.id != ""',
      createRule: '',
      updateRule: '',
      deleteRule: '',
    },
    'categories': {
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" || @request.auth.admin = true',
      deleteRule: '@request.auth.id != "" || @request.auth.admin = true',
    },
    'products': {
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.id != "" || @request.auth.admin = true',
      deleteRule: '@request.auth.id != "" || @request.auth.admin = true',
    },
    'media': {
      listRule: '@request.auth.id != ""',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.admin = true',
      deleteRule: '@request.auth.id != "" || @request.auth.admin = true',
    },
    'user_tenants': {
      listRule: '@request.auth.admin = true || user.id = @request.auth.id',
      viewRule: '@request.auth.id != ""',
      createRule: '@request.auth.admin = true',
      updateRule: '@request.auth.admin = true',
      deleteRule: '@request.auth.admin = true',
    },
  };

  for (const [name, rules] of Object.entries(ruleUpdates)) {
    const col = allCollections.find(c => c.name === name);
    if (!col) {
      console.log(`  - ${name}: not found, skipping`);
      continue;
    }
    try {
      await pb.collections.update(col.id, rules);
      console.log(`  ✓ ${name}: rules updated`);
    } catch (e: any) {
      console.log(`  ✗ ${name}: failed - ${e.status} ${e.message}`);
    }
  }

  console.log();

  // Step 1b: Ensure media collection has a 'file' field (required for uploads)
  // and that its maxSize matches the current limit. Existing deployments
  // created with the old 10 MiB cap need this bumped in place.
  console.log('Step 1b: Ensuring media collection has a file field...');
  const DESIRED_FILE_MAX_SIZE = 524288000; // 500 MiB
  const DESIRED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];
  try {
    const mediaCol = allCollections.find(c => c.name === 'media');
    if (mediaCol) {
      const hasFileField = mediaCol.schema?.some((f: any) => f.name === 'file');
      let cleanedSchema: any[];
      if (!hasFileField) {
        cleanedSchema = [
          ...(mediaCol.schema || []),
          { name: 'file', type: 'file', options: { maxSelect: 1, maxSize: DESIRED_FILE_MAX_SIZE, mimeTypes: DESIRED_MIME_TYPES } },
        ];
        cleanedSchema = cleanedSchema.map((f: any) =>
          f.name === 'filename' ? { ...f, required: false } : f
        );
        await pb.collections.update(mediaCol.id, { schema: cleanedSchema });
        console.log('  ✓ Added file field to media collection');
      } else {
        // Update maxSize / mimeTypes on the existing field if they differ.
        let touched = false;
        cleanedSchema = (mediaCol.schema || []).map((f: any) => {
          if (f.name !== 'file') return f;
          const opts = f.options || {};
          const needsMaxSize = opts.maxSize !== DESIRED_FILE_MAX_SIZE;
          const mimeSet = new Set(opts.mimeTypes || []);
          const desiredSet = new Set(DESIRED_MIME_TYPES);
          const mimeDiff =
            mimeSet.size !== desiredSet.size ||
            [...desiredSet].some(m => !mimeSet.has(m));
          if (!needsMaxSize && !mimeDiff) return f;
          touched = true;
          return { ...f, options: { ...opts, maxSize: DESIRED_FILE_MAX_SIZE, mimeTypes: [...DESIRED_MIME_TYPES] } };
        });
        if (touched) {
          cleanedSchema = cleanedSchema.map((f: any) =>
            f.name === 'filename' ? { ...f, required: false } : f
          );
          await pb.collections.update(mediaCol.id, { schema: cleanedSchema });
          console.log(`  ✓ Updated file field maxSize to ${DESIRED_FILE_MAX_SIZE}`);
        } else {
          console.log('  - file field already up to date');
        }
      }
    }
  } catch (e: any) {
    console.log(`  ✗ Failed: ${e.status} ${e.message}`);
  }

  console.log();

  // Step 1c: Ensure instance_settings has the storage fields
  console.log('Step 1c: Ensuring instance_settings has storage fields...');
  try {
    const settingsCol = allCollections.find(c => c.name === 'instance_settings');
    if (settingsCol) {
      const required = ['storage_type', 's3_bucket', 's3_region', 's3_endpoint', 's3_access_key', 's3_secret_key', 's3_force_path_style', 'storage_configured'];
      const existing = new Set((settingsCol.schema || []).map((f: any) => f.name));
      const missing = required.filter(n => !existing.has(n));
      if (missing.length > 0) {
        const newFields = missing.map(name => {
          if (name === 's3_force_path_style' || name === 'storage_configured') {
            return { name, type: 'bool' };
          }
          return { name, type: 'text' };
        });
        const updatedSchema = [...(settingsCol.schema || []), ...newFields];
        await pb.collections.update(settingsCol.id, { schema: updatedSchema });
        console.log(`  ✓ Added fields: ${missing.join(', ')}`);
      } else {
        console.log('  - all storage fields already exist');
      }
    } else {
      console.log('  - instance_settings collection not found, skipping');
    }
  } catch (e: any) {
    console.log(`  ✗ Failed: ${e.status} ${e.message}`);
  }

  console.log();

  // Step 1d: If instance_settings has s3 config, ensure PB settings.S3 is enabled
  console.log('Step 1d: Syncing S3 settings to PocketBase if configured...');
  try {
    const settingsList = await pb.collection('instance_settings').getFullList();
    const inst = settingsList[0];
    if (inst && inst.storage_type === 's3') {
      const missing: string[] = [];
      if (!inst.s3_bucket) missing.push('s3_bucket');
      if (!inst.s3_region) missing.push('s3_region');
      if (!inst.s3_endpoint) missing.push('s3_endpoint');
      if (!inst.s3_access_key) missing.push('s3_access_key');
      if (!inst.s3_secret_key) missing.push('s3_secret_key');
      if (missing.length > 0) {
        console.log(`  - S3 configured but missing fields: ${missing.join(', ')}`);
      } else {
        await pb.settings.update({
          s3: {
            enabled: true,
            bucket: inst.s3_bucket,
            region: inst.s3_region,
            endpoint: inst.s3_endpoint,
            accessKey: inst.s3_access_key,
            secret: inst.s3_secret_key,
            forcePathStyle: !!inst.s3_force_path_style,
          },
        });
        console.log(`  ✓ Synced S3 settings to PB (bucket: ${inst.s3_bucket})`);
      }
    } else {
      console.log('  - storage_type is not s3, skipping');
    }
  } catch (e: any) {
    console.log(`  ✗ Failed: ${e.status} ${e.message}`);
  }

  console.log();

  // Step 2: Ensure default roles exist
  console.log('Step 2: Ensuring default roles exist...');
  try {
    const existingRoles = await pb.collection('roles').getFullList();
    const roleNames = new Set(existingRoles.map(r => r.name));

    for (const roleName of ['viewer', 'editor', 'admin']) {
      if (!roleNames.has(roleName)) {
        try {
          await pb.collection('roles').create({ name: roleName });
          console.log(`  ✓ Created role: ${roleName}`);
        } catch (e: any) {
          console.log(`  ✗ Failed to create ${roleName}: ${e.message}`);
        }
      } else {
        console.log(`  - ${roleName}: already exists`);
      }
    }
  } catch (e: any) {
    console.log(`  ✗ Failed to check roles: ${e.message}`);
  }

  console.log();

  // Step 3: Ensure default tenant exists
  console.log('Step 3: Ensuring default tenant exists...');
  try {
    const existingTenants = await pb.collection('tenants').getFullList();
    let defaultTenant = existingTenants.find(t => t.slug === 'default-company');

    if (!defaultTenant) {
      defaultTenant = await pb.collection('tenants').create({
        name: 'Default Company',
        slug: 'default-company',
        plan: 'starter',
      });
      console.log(`  ✓ Created default tenant: ${defaultTenant.id}`);
    } else {
      console.log(`  - default tenant already exists: ${defaultTenant.id}`);
    }
  } catch (e: any) {
    console.log(`  ✗ Failed: ${e.message}`);
  }

  console.log();

  // Step 4: Fix orphaned user_tenants records
  console.log('Step 4: Checking user_tenants for orphaned references...');
  try {
    const userTenants = await pb.collection('user_tenants').getFullList();
    const tenants = await pb.collection('tenants').getFullList();
    const tenantIds = new Set(tenants.map(t => t.id));
    const defaultTenant = tenants.find(t => t.slug === 'default-company') || tenants[0];

    let fixed = 0;
    let deleted = 0;

    for (const ut of userTenants) {
      if (!tenantIds.has(ut.tenant)) {
        console.log(`  - user_tenants ${ut.id}: tenant ${ut.tenant} doesn't exist`);
        if (defaultTenant) {
          try {
            await pb.collection('user_tenants').update(ut.id, { tenant: defaultTenant.id });
            console.log(`    ✓ Updated to use default tenant`);
            fixed++;
          } catch (e: any) {
            console.log(`    ✗ Failed to update: ${e.message}`);
          }
        } else {
          try {
            await pb.collection('user_tenants').delete(ut.id);
            console.log(`    ✓ Deleted orphaned record`);
            deleted++;
          } catch (e: any) {
            console.log(`    ✗ Failed to delete: ${e.message}`);
          }
        }
      }
    }
    console.log(`  Summary: ${fixed} fixed, ${deleted} deleted`);
  } catch (e: any) {
    console.log(`  ✗ Failed: ${e.message}`);
  }

  console.log();
  console.log('=== Fix Complete ===');
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
