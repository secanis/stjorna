import { describe, it, expect } from 'vitest';
import { formatCustomFields, parseCustomFields } from './customFields';

describe('formatCustomFields', () => {
  it('returns empty string for empty values', () => {
    expect(formatCustomFields(null)).toBe('');
    expect(formatCustomFields(undefined)).toBe('');
    expect(formatCustomFields('')).toBe('');
  });

  it('pretty-prints objects instead of [object Object]', () => {
    const out = formatCustomFields({ color: 'red', size: 2 });
    expect(out).not.toContain('[object Object]');
    expect(JSON.parse(out)).toEqual({ color: 'red', size: 2 });
  });

  it('pretty-prints JSON-encoded legacy strings', () => {
    expect(JSON.parse(formatCustomFields('{"a":1}'))).toEqual({ a: 1 });
  });

  it('keeps non-JSON strings verbatim', () => {
    expect(formatCustomFields('[object Object]')).toBe('[object Object]');
  });
});

describe('parseCustomFields', () => {
  it('treats blank input as null', () => {
    expect(parseCustomFields('   ')).toEqual({ ok: true, value: null });
  });

  it('parses objects', () => {
    expect(parseCustomFields('{"a": {"b": [1,2]}}')).toEqual({ ok: true, value: { a: { b: [1, 2] } } });
  });

  it('rejects invalid JSON', () => {
    expect(parseCustomFields('{nope').ok).toBe(false);
  });

  it('rejects non-object JSON', () => {
    expect(parseCustomFields('[1,2]').ok).toBe(false);
    expect(parseCustomFields('"str"').ok).toBe(false);
    expect(parseCustomFields('42').ok).toBe(false);
  });

  it('round-trips with formatCustomFields', () => {
    const value = { color: 'red', tags: ['a', 'b'], nested: { n: 1 } };
    expect(parseCustomFields(formatCustomFields(value))).toEqual({ ok: true, value });
  });
});
