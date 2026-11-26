const path = require('path');
const { describe, it, expect } = require('@jest/globals');
const { _test: { normalizeFolder, entryIndexFor, scopeRootOf, specConversionOptions } } = require('../../src/ipc/openapi-sync');

describe('folder-scoped sync entries', () => {
  const brunoConfig = {
    openapi: [
      { sourceUrl: 'a.json', groupBy: 'path' },
      { sourceUrl: 'b.json', groupBy: 'tags', folder: 'Pets/v2' }
    ]
  };

  it('normalizes folder paths', () => {
    expect(normalizeFolder('\\Pets\\v2/')).toBe('Pets/v2');
    expect(normalizeFolder(undefined)).toBe('');
  });

  it('finds the legacy entry without a folder and the entry of a folder', () => {
    expect(entryIndexFor(brunoConfig)).toBe(0);
    expect(entryIndexFor(brunoConfig, 'Pets/v2')).toBe(1);
    expect(entryIndexFor(brunoConfig, 'Other')).toBe(-1);
  });

  it('reads conversion options from the entry of the folder', () => {
    expect(specConversionOptions(brunoConfig, undefined, 'Pets/v2').groupBy).toBe('tags');
    expect(specConversionOptions(brunoConfig).groupBy).toBe('path');
  });

  it('scopes the disk root to the folder and rejects traversal', () => {
    const app = path.resolve('some', 'app');
    expect(scopeRootOf(app)).toBe(app);
    expect(scopeRootOf(app, 'Pets/v2')).toBe(path.join(app, 'Pets', 'v2'));
    expect(() => scopeRootOf(app, '../evil')).toThrow(/Invalid/);
  });
});
