import { cleanup } from './global-setup';

export default async function globalTeardown() {
  await cleanup();
}