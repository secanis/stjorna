import { describe, it, expect } from 'vitest';
import { fuzzyMatch, fuzzyScore } from './fuzzy';

describe('fuzzyMatch', () => {
  it('matches an empty query against anything', () => {
    expect(fuzzyMatch('Anything', '')).toBe(true);
    expect(fuzzyMatch('', '   ')).toBe(true);
  });

  it('matches case-insensitive substrings', () => {
    expect(fuzzyMatch('Wireless Mouse', 'mouse')).toBe(true);
    expect(fuzzyMatch('Wireless Mouse', 'MOUSE')).toBe(true);
    expect(fuzzyMatch('Wireless Mouse', 'less')).toBe(true);
  });

  it('matches subsequences (fuzzy)', () => {
    expect(fuzzyMatch('Product', 'pdt')).toBe(true);
    expect(fuzzyMatch('Wireless Mouse', 'wl mse')).toBe(true);
  });

  it('rejects non-matching queries', () => {
    expect(fuzzyMatch('Product', 'xyz')).toBe(false);
    expect(fuzzyMatch('Wireless Mouse', 'mse wl')).toBe(false);
  });
});

describe('fuzzyScore', () => {
  it('returns -1 for no match', () => {
    expect(fuzzyScore('Product', 'xyz')).toBe(-1);
  });

  it('ranks exact, prefix and substring above fuzzy', () => {
    const exact = fuzzyScore('Mouse', 'mouse');
    const prefix = fuzzyScore('Mouse Pad', 'mouse');
    const substring = fuzzyScore('Wireless Mouse', 'mouse');
    const fuzzy = fuzzyScore('M o u s e', 'mouse');
    expect(exact).toBeGreaterThan(prefix);
    expect(prefix).toBeGreaterThan(substring);
    expect(substring).toBeGreaterThan(fuzzy);
    expect(fuzzy).toBeGreaterThan(-1);
  });
});
