import { getSyncEntry, getSyncScopedCollection, listSyncEntries, normalizeSyncFolder, syncKeyOf } from './index';

const collection = {
  uid: 'app1',
  pathname: 'C:\\apps\\shop',
  brunoConfig: {
    openapi: [
      { sourceUrl: 'https://a.test/all.json' },
      { sourceUrl: 'https://a.test/pets.json', folder: 'Pets' }
    ]
  },
  items: [
    { uid: 'f1', type: 'folder', name: 'Pets', pathname: 'C:\\apps\\shop\\Pets', items: [{ uid: 'r1', type: 'http-request' }] },
    { uid: 'f2', type: 'folder', name: 'Other', pathname: 'C:\\apps\\shop\\Other', items: [{ uid: 'r2', type: 'http-request' }] }
  ]
};

describe('openapi sync scope', () => {
  it('keys the legacy entry by the application uid and folder entries by uid and folder', () => {
    expect(syncKeyOf('app1', '')).toBe('app1');
    expect(syncKeyOf('app1', 'Pets/')).toBe('app1::Pets');
    expect(normalizeSyncFolder('\\Pets\\v2\\')).toBe('Pets/v2');
  });

  it('finds the entry of a folder and the application-wide one separately', () => {
    expect(getSyncEntry(collection, '').sourceUrl).toBe('https://a.test/all.json');
    expect(getSyncEntry(collection, 'Pets').sourceUrl).toBe('https://a.test/pets.json');
    expect(getSyncEntry(collection, 'Other')).toBeNull();
    expect(listSyncEntries(collection).map(({ folder }) => folder)).toEqual(['', 'Pets']);
  });

  it('returns the application itself for the application-wide entry', () => {
    expect(getSyncScopedCollection(collection, '')).toBe(collection);
  });

  it('limits a folder entry to the items of its folder and to its own config entry', () => {
    const scoped = getSyncScopedCollection(collection, 'Pets');

    expect(scoped.items.map((item) => item.uid)).toEqual(['r1']);
    expect(scoped.brunoConfig.openapi).toEqual([{ sourceUrl: 'https://a.test/pets.json', folder: 'Pets' }]);
    expect(scoped).toMatchObject({ uid: 'app1', syncFolder: 'Pets', syncKey: 'app1::Pets', syncFolderName: 'Pets' });
  });

  it('has no entry and no items for a folder that is not connected or not loaded', () => {
    const scoped = getSyncScopedCollection(collection, 'Missing');

    expect(scoped.items).toEqual([]);
    expect(scoped.brunoConfig.openapi).toEqual([]);
  });
});
