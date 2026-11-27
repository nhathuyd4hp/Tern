import { migrateLegacyLocalStorageKeys } from './migrateLocalStorage';

describe('migrateLegacyLocalStorageKeys', () => {
  beforeEach(() => localStorage.clear());

  it('moves bruno.* keys to tern.* and removes the old ones', () => {
    localStorage.setItem('bruno.theme', 'dark');
    localStorage.setItem('bruno.graphqlSchema.abc', 'hash');
    migrateLegacyLocalStorageKeys();
    expect(localStorage.getItem('tern.theme')).toBe('dark');
    expect(localStorage.getItem('tern.graphqlSchema.abc')).toBe('hash');
    expect(localStorage.getItem('bruno.theme')).toBeNull();
  });

  it('keeps a value that already exists under the new key', () => {
    localStorage.setItem('bruno.theme', 'dark');
    localStorage.setItem('tern.theme', 'light');
    migrateLegacyLocalStorageKeys();
    expect(localStorage.getItem('tern.theme')).toBe('light');
    expect(localStorage.getItem('bruno.theme')).toBeNull();
  });
});
