import { startPocketBase } from '../setup';
import globalTeardown from './global-teardown';

// Vitest has no `globalTeardown` option (that's Playwright); teardown runs
// only when globalSetup returns it. Without this the PB container outlives
// the run and the next run's tests silently hit the stale instance.
export default async function globalSetup() {
  console.log('[vitest global-setup] Starting shared PocketBase instance...');
  await startPocketBase();
  console.log('[vitest global-setup] PocketBase ready');
  return globalTeardown;
}
