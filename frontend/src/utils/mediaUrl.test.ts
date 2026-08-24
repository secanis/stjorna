/// <reference types="vitest" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getMediaFileUrl, buildAbsolutePath } from './mediaUrl';

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

  it('prefixes absolute origin when VITE_PB_URL is set (cross-origin)', () => {
    vi.stubEnv('VITE_PB_URL', 'https://pb.example.com');
    try {
      (pb.authStore as any).token = 'tok';
      const url = getMediaFileUrl('rec1', 'img.jpg', { thumb: '200x200' });
      expect(url).toBe('https://pb.example.com/api/files/media/rec1/img.jpg?token=tok&thumb=200x200');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('returns relative URL when VITE_PB_URL is empty (proxy handles same-origin)', () => {
    vi.stubEnv('VITE_PB_URL', '');
    try {
      (pb.authStore as any).token = 'tok';
      const url = getMediaFileUrl('rec1', 'img.jpg');
      expect(url).toBe('/api/files/media/rec1/img.jpg?token=tok');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('drops http:// when page is HTTPS — protocol-relative URL avoids mixed content', () => {
    expect(buildAbsolutePath('http://pb.internal:8090', '/api/x', 'https:'))
      .toBe('//pb.internal:8090/api/x');
  });

  it('keeps https:// origin unchanged when page is HTTPS', () => {
    expect(buildAbsolutePath('https://pb.example.com', '/api/x', 'https:'))
      .toBe('https://pb.example.com/api/x');
  });

  it('keeps http:// origin when page is also HTTP (dev)', () => {
    expect(buildAbsolutePath('http://localhost:8090', '/api/x', 'http:'))
      .toBe('http://localhost:8090/api/x');
  });

  it('returns relative path when origin is empty (proxy handles same-origin)', () => {
    expect(buildAbsolutePath('', '/api/x', 'https:')).toBe('/api/x');
    expect(buildAbsolutePath('', '/api/x', 'http:')).toBe('/api/x');
  });

  it('keeps http:// origin when page is also HTTP (dev)', () => {
    vi.stubEnv('VITE_PB_URL', 'http://localhost:8090');
    try {
      const url = getMediaFileUrl('rec1', 'img.jpg');
      expect(url).toBe('http://localhost:8090/api/files/media/rec1/img.jpg');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('handles filenames with special characters (no escaping)', () => {
    const url = getMediaFileUrl('rec1', 'image with spaces.png');
    expect(url).toBe('/api/files/media/rec1/image with spaces.png');
  });
});
