/// <reference types="vitest" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getMediaFileUrl } from './mediaUrl';

vi.mock('~/services/pocketbase', () => {
  return {
    pb: {
      authStore: {
        token: '',
      },
    },
  };
});

import { pb } from '~/services/pocketbase';

describe('getMediaFileUrl', () => {
  const originalToken = pb.authStore.token;

  beforeEach(() => {
    (pb.authStore as any).token = '';
  });

  afterEach(() => {
    (pb.authStore as any).token = originalToken;
  });

  it('returns empty string when recordId is missing', () => {
    expect(getMediaFileUrl('', 'file.png')).toBe('');
  });

  it('returns empty string when filename is missing', () => {
    expect(getMediaFileUrl('rec123', '')).toBe('');
  });

  it('builds a basic URL with no token or thumb', () => {
    (pb.authStore as any).token = '';
    const url = getMediaFileUrl('rec123', 'file.png');
    expect(url).toBe('/api/files/media/rec123/file.png');
  });

  it('appends the auth token when present', () => {
    (pb.authStore as any).token = 'jwt-abc-123';
    const url = getMediaFileUrl('rec123', 'file.png');
    expect(url).toBe('/api/files/media/rec123/file.png?token=jwt-abc-123');
  });

  it('appends thumb when provided', () => {
    const url = getMediaFileUrl('rec123', 'file.png', { thumb: '100x100' });
    expect(url).toBe('/api/files/media/rec123/file.png?thumb=100x100');
  });

  it('appends both token and thumb (token first)', () => {
    (pb.authStore as any).token = 'jwt-abc';
    const url = getMediaFileUrl('rec123', 'file.png', { thumb: '50x50' });
    expect(url).toBe('/api/files/media/rec123/file.png?token=jwt-abc&thumb=50x50');
  });

  it('returns relative URL regardless of VITE_PB_URL (routes through proxy)', () => {
    vi.stubEnv('VITE_PB_URL', 'https://pb.example.com');
    try {
      (pb.authStore as any).token = 'tok';
      const url = getMediaFileUrl('rec1', 'img.jpg', { thumb: '200x200' });
      expect(url).toBe('/api/files/media/rec1/img.jpg?token=tok&thumb=200x200');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('handles filenames with special characters (no escaping)', () => {
    const url = getMediaFileUrl('rec1', 'image with spaces.png');
    expect(url).toBe('/api/files/media/rec1/image with spaces.png');
  });
});
