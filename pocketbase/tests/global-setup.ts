import { startPocketBase } from '../setup';

export default async function globalSetup() {
  console.log('[vitest global-setup] Starting shared PocketBase instance...');
  await startPocketBase();
  console.log('[vitest global-setup] PocketBase ready');
}