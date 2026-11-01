import { ClientResponseError } from 'pocketbase';

/**
 * Best-effort human-readable message from an unknown thrown value.
 *
 * PocketBase SDK throws `ClientResponseError` (carries a server `response`
 * with the real reason); network/other failures throw `Error` or plain values.
 * Centralising this avoids spreading `e.response?.message || e.message`
 * narrowing and lets call sites use `catch (e: unknown)` instead of `any`.
 */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof ClientResponseError) {
    return err.response?.message || err.message || fallback;
  }
  if (err instanceof Error) {
    return err.message || fallback;
  }
  if (typeof err === 'string' && err.length > 0) {
    return err;
  }
  return fallback;
}
