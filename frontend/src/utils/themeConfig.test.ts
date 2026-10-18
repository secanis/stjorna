import { describe, it, expect } from 'vitest';
import { parseThemeConfig, buildThemeConfig, asTrimmedString } from './themeConfig';

describe('parseThemeConfig', () => {
    it('returns {} for empty values', () => {
        expect(parseThemeConfig(null)).toEqual({});
        expect(parseThemeConfig(undefined as unknown as null)).toEqual({});
        expect(parseThemeConfig('')).toEqual({});
    });

    it('passes through plain objects', () => {
        expect(parseThemeConfig({ logoMediaId: 'abc' })).toEqual({ logoMediaId: 'abc' });
    });

    it('parses legacy JSON strings', () => {
        expect(parseThemeConfig('{"headerBgDark":"#123456"}')).toEqual({ headerBgDark: '#123456' });
    });

    it('returns {} for invalid strings and non-objects', () => {
        expect(parseThemeConfig('{broken')).toEqual({});
        expect(parseThemeConfig('[1,2]')).toEqual({});
        expect(parseThemeConfig('"str"')).toEqual({});
    });
});

describe('asTrimmedString', () => {
    it('trims strings and coerces non-strings to empty', () => {
        expect(asTrimmedString('  #fff ')).toBe('#fff');
        expect(asTrimmedString(5)).toBe('');
        expect(asTrimmedString(undefined)).toBe('');
        expect(asTrimmedString({})).toBe('');
    });
});

describe('buildThemeConfig', () => {
    it('writes only non-empty known keys', () => {
        expect(buildThemeConfig({}, { logoMediaId: 'x1', headerBgLight: '', headerBgDark: ' #000 ' })).toEqual({
            logoMediaId: 'x1',
            headerBgDark: '#000',
        });
    });

    it('preserves unknown keys but lets fields override known ones', () => {
        const out = buildThemeConfig(
            { futureKey: 1, logoMediaId: 'old' },
            { logoMediaId: '', headerBgLight: '#fff', headerBgDark: '' },
        );
        expect(out).toEqual({ futureKey: 1, headerBgLight: '#fff' });
    });

    it('drops known keys when cleared', () => {
        expect(buildThemeConfig({ headerBgDark: '#000' }, { logoMediaId: '', headerBgLight: '', headerBgDark: '' })).toEqual({});
    });
});
