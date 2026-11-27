import { sanitizeTag, sanitizeTags } from '../../src/common/index.js';

describe('sanitizeTag', () => {
  it('returns null for unusable input', () => {
    expect(sanitizeTag(null)).toBeNull();
    expect(sanitizeTag(undefined)).toBeNull();
    expect(sanitizeTag(123)).toBeNull();
    expect(sanitizeTag('')).toBeNull();
    expect(sanitizeTag('   ')).toBeNull();
    expect(sanitizeTag({})).toBeNull();
  });

  it('preserves the tag verbatim, including spaces and punctuation', () => {
    expect(sanitizeTag('Pets & Dogs')).toBe('Pets & Dogs');
    expect(sanitizeTag('R&D')).toBe('R&D');
    expect(sanitizeTag('&')).toBe('&');
    expect(sanitizeTag('api.v1')).toBe('api.v1');
    expect(sanitizeTag('API (v1)')).toBe('API (v1)');
  });

  it('trims surrounding whitespace but keeps inner whitespace', () => {
    expect(sanitizeTag('  Pets & Dogs  ')).toBe('Pets & Dogs');
  });

  it('reads .name from tag-object input', () => {
    expect(sanitizeTag({ name: 'R&D' })).toBe('R&D');
  });
});

describe('sanitizeTags', () => {
  it('returns an empty array for non-array input', () => {
    expect(sanitizeTags(null)).toEqual([]);
    expect(sanitizeTags(undefined)).toEqual([]);
    expect(sanitizeTags('string')).toEqual([]);
    expect(sanitizeTags({})).toEqual([]);
    expect(sanitizeTags([])).toEqual([]);
  });

  it('removes empty values and duplicates, keeping first-occurrence order', () => {
    expect(sanitizeTags(['tag1', '  ', 'tag2', 'tag1', null])).toEqual(['tag1', 'tag2']);
  });
});
