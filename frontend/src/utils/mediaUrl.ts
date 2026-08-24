import { pb } from '~/services/pocketbase';

interface MediaUrlOptions {
  thumb?: string;
}

// Indirection over `window.location.protocol` so tests can mock it.
function pageProtocol(): string {
  if (typeof window === 'undefined') return 'http:';
  return window.location.protocol;
}

// Pure URL builder — exposed for tests. Takes the configured origin and the
// current page protocol explicitly so the test can drive the protocol
// branch without fighting jsdom's read-only Location.
//
// Mixed-content handling:
//   - empty origin → relative URL (same-origin via vite proxy / nginx)
//   - origin with `http://` while page is HTTPS → protocol-relative URL
//     (browser inherits `https:`), avoids "Mixed Content" blocks
//   - origin already matches page protocol → use as-is
//
// Operators who serve PB over plain HTTP behind an HTTPS proxy should leave
//   `VITE_PB_URL` empty so the relative path + reverse-proxy path is taken.
export function buildAbsolutePath(origin: string, path: string, pageProto: string): string {
  if (!origin) return path;
  if (pageProto === 'https:' && origin.startsWith('http://')) {
    return `${origin.replace(/^http:/, '')}${path}`;
  }
  return `${origin}${path}`;
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
  return buildAbsolutePath(pbOrigin(), path, pageProtocol());
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
