import { pb } from '~/services/pocketbase';

interface MediaUrlOptions {
  thumb?: string;
}

// Returns the configured PB origin (without trailing slash) if the FE was
// built with an explicit VITE_PB_URL — meaning the FE and PB live on
// different origins and the FE must hit PB directly. Returns '' otherwise
// (empty VITE_PB_URL = FE and PB share an origin, vite proxy handles it).
function pbOrigin(): string {
  return (import.meta.env.VITE_PB_URL as string | undefined)?.replace(/\/+$/, '') || '';
}

function buildFileUrl(recordId: string, filename: string, options: MediaUrlOptions, includeToken: boolean): string {
  if (!recordId || !filename) return '';
  const params = new URLSearchParams();
  if (includeToken) {
    const token = pb.authStore.token;
    if (token) params.set('token', token);
  }
  if (options.thumb) params.set('thumb', options.thumb);
  const qs = params.toString();
  const path = `/api/files/media/${recordId}/${filename}${qs ? '?' + qs : ''}`;
  const origin = pbOrigin();
  return origin ? `${origin}${path}` : path;
}

export function getMediaFileUrl(
  recordId: string,
  filename: string,
  options: MediaUrlOptions = {}
): string {
  return buildFileUrl(recordId, filename, options, true);
}

// Same as getMediaFileUrl but without the auth token — safe to copy/paste
// for display in the UI or external sharing.
export function getMediaFileUrlAbsolute(
  recordId: string,
  filename: string,
  options: MediaUrlOptions = {}
): string {
  return buildFileUrl(recordId, filename, options, false);
}
