import { pb } from '~/services/pocketbase';

export interface MediaUrlOptions {
  thumb?: string;
}

export function getMediaFileUrl(
  recordId: string,
  filename: string,
  options: MediaUrlOptions = {}
): string {
  if (!recordId || !filename) return '';
  const baseUrl = import.meta.env.VITE_PB_URL || 'http://localhost:8090';
  const params = new URLSearchParams();
  const token = pb.authStore.token;
  if (token) params.set('token', token);
  if (options.thumb) params.set('thumb', options.thumb);
  const qs = params.toString();
  return `${baseUrl}/api/files/media/${recordId}/${filename}${qs ? '?' + qs : ''}`;
}
