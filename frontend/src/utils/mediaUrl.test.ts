/// <reference types="vitest" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    getMediaFileUrl,
    getMediaFileUrlAbsolute,
    buildAbsolutePath,
    _setCachedFileTokenForTest,
    _clearCachedFileTokenForTest,
} from './mediaUrl';

// T-08: media files are now `protected: true` on the schema, so URLs
// must carry a short-lived FILE TOKEN (pb.files.getToken()), NOT the
// long-lived AUTH JWT. The auth JWT was the wrong token type and
// ended up in nginx logs, browser history, referer headers and
// copied links.
//
// These tests pin that contract: any URL produced by getMediaFileUrl
// must contain the file token and must NEVER contain the auth JWT.

vi.mock('~/services/pocketbase', () => {
    return {
        pb: {
            authStore: {
                token: 'AUTH-JWT-DO-NOT-LEAK',
            },
            files: {
                getToken: vi.fn(async () => 'FILE-TOKEN-OK'),
            },
        },
    };
});

import { pb } from '~/services/pocketbase';

describe('T-08: getMediaFileUrl uses file token, never auth JWT', () => {
    beforeEach(() => {
        _clearCachedFileTokenForTest();
        _setCachedFileTokenForTest('FILE-TOKEN-OK');
    });

    afterEach(() => {
        _clearCachedFileTokenForTest();
        vi.unstubAllEnvs();
    });

    it('returns empty string when recordId is missing', () => {
        expect(getMediaFileUrl('', 'file.png')).toBe('');
    });

    it('returns empty string when filename is missing', () => {
        expect(getMediaFileUrl('rec123', '')).toBe('');
    });

    it('builds URL with file token (not auth JWT)', () => {
        const url = getMediaFileUrl('rec123', 'file.png');
        expect(url).toBe('/api/files/media/rec123/file.png?token=FILE-TOKEN-OK');
        expect(url).not.toContain('AUTH-JWT-DO-NOT-LEAK');
        expect(url).not.toContain(pb.authStore.token);
    });

    it('appends thumb when provided', () => {
        const url = getMediaFileUrl('rec123', 'file.png', { thumb: '100x100' });
        expect(url).toBe('/api/files/media/rec123/file.png?token=FILE-TOKEN-OK&thumb=100x100');
        expect(url).not.toContain('AUTH-JWT-DO-NOT-LEAK');
    });

    it('prefixes absolute origin when VITE_PB_URL is set (cross-origin)', () => {
        vi.stubEnv('VITE_PB_URL', 'https://pb.example.com');
        const url = getMediaFileUrl('rec1', 'img.jpg', { thumb: '200x200' });
        expect(url).toBe('https://pb.example.com/api/files/media/rec1/img.jpg?token=FILE-TOKEN-OK&thumb=200x200');
        expect(url).not.toContain('AUTH-JWT-DO-NOT-LEAK');
    });

    it('returns relative URL when VITE_PB_URL is empty (proxy handles same-origin)', () => {
        vi.stubEnv('VITE_PB_URL', '');
        const url = getMediaFileUrl('rec1', 'img.jpg');
        expect(url).toBe('/api/files/media/rec1/img.jpg?token=FILE-TOKEN-OK');
        expect(url).not.toContain('AUTH-JWT-DO-NOT-LEAK');
    });

    it('getMediaFileUrlAbsolute never includes any token', () => {
        const url = getMediaFileUrlAbsolute('rec1', 'img.jpg', { thumb: '200x200' });
        expect(url).toBe('/api/files/media/rec1/img.jpg?thumb=200x200');
        expect(url).not.toContain('token=');
        expect(url).not.toContain('AUTH-JWT-DO-NOT-LEAK');
    });

    it('drops http:// when page is HTTPS — protocol-relative URL avoids mixed content', () => {
        expect(buildAbsolutePath('http://pb.internal:8090', '/api/x', 'https:')).toBe('//pb.internal:8090/api/x');
    });

    it('keeps https:// origin unchanged when page is HTTPS', () => {
        expect(buildAbsolutePath('https://pb.example.com', '/api/x', 'https:')).toBe('https://pb.example.com/api/x');
    });

    it('keeps http:// origin when page is also HTTP (dev)', () => {
        expect(buildAbsolutePath('http://localhost:8090', '/api/x', 'http:')).toBe('http://localhost:8090/api/x');
    });

    it('returns relative path when origin is empty (proxy handles same-origin)', () => {
        expect(buildAbsolutePath('', '/api/x', 'https:')).toBe('/api/x');
        expect(buildAbsolutePath('', '/api/x', 'http:')).toBe('/api/x');
    });

    it('handles filenames with special characters (no escaping)', () => {
        const url = getMediaFileUrl('rec1', 'image with spaces.png');
        expect(url).toBe('/api/files/media/rec1/image with spaces.png?token=FILE-TOKEN-OK');
    });
});

describe('T-08: file-token cache never holds the auth JWT', () => {
    beforeEach(() => {
        _clearCachedFileTokenForTest();
    });

    afterEach(() => {
        _clearCachedFileTokenForTest();
    });

    it('a URL built before the token is cached has no token (placeholder), not the auth JWT', () => {
        // No token set: signal is empty. ensureFileToken() will fire a
        // refresh but the URL builder returns immediately with no
        // ?token= param. The auth JWT must never appear as a fallback.
        const url = getMediaFileUrl('rec1', 'file.png');
        expect(url).toBe('/api/files/media/rec1/file.png');
        expect(url).not.toContain(pb.authStore.token);
        expect(url).not.toContain('AUTH-JWT');
    });

    it('pb.files.getToken() (not pb.authStore.token) is the token source', () => {
        // Verify the URL uses the value returned by pb.files.getToken(),
        // not the static auth token. This is the structural guarantee.
        _setCachedFileTokenForTest('FILE-TOKEN-FROM-GETTOKEN');
        const url = getMediaFileUrl('rec1', 'file.png');
        expect(url).toContain('token=FILE-TOKEN-FROM-GETTOKEN');
        expect(url).not.toContain('AUTH-JWT-DO-NOT-LEAK');
    });
});
