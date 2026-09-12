import { cleanup } from '../setup';

export default async function globalTeardown() {
  console.log('[vitest global-teardown] Stopping shared PocketBase instance...');
  await cleanup();
  console.log('[vitest global-teardown] PocketBase stopped');
}