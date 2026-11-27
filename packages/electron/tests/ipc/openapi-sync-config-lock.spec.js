const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn(), on: jest.fn() },
  app: { getPath: jest.fn(() => require('os').tmpdir()), getVersion: jest.fn(() => '1.0.0') }
}));

// A slow write makes overlapping edits interleave, which is what the lock has to prevent.
jest.mock('../../src/utils/filesystem', () => {
  const actual = jest.requireActual('../../src/utils/filesystem');
  return { ...actual, writeFile: async (...args) => {
    await new Promise((resolve) => setTimeout(resolve, 20)); return actual.writeFile(...args);
  } };
});

const { parseCollection, stringifyCollection } = require('@tern/filestore');
const registerOpenAPISyncIpc = require('../../src/ipc/openapi-sync');
const { addFolderSyncEntry } = registerOpenAPISyncIpc;
const { ipcMain } = require('electron');

const SPEC = JSON.stringify({ openapi: '3.0.0', info: { title: 't', version: '1' }, paths: {} });

describe('OpenAPI sync config edits', () => {
  it('keeps every entry when several folders are connected at the same time', async () => {
    const collectionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'tern-sync-'));
    fs.writeFileSync(path.join(collectionPath, 'opencollection.yml'), stringifyCollection({}, { opencollection: '1.0.0', name: 'app', type: 'collection' }));
    const folders = ['a', 'b', 'c', 'd'];
    folders.forEach((folder) => fs.mkdirSync(path.join(collectionPath, folder)));

    await Promise.all(folders.map((folder) => addFolderSyncEntry({
      collectionPath,
      folder,
      entry: { sourceUrl: `https://example.com/${folder}.json`, groupBy: 'tags' },
      specContent: SPEC
    })));

    const { brunoConfig: saved } = parseCollection(fs.readFileSync(path.join(collectionPath, 'opencollection.yml'), 'utf8'));
    expect(saved.openapi.map((entry) => entry.folder).sort()).toEqual(folders);
  });

  it('does not add an application-wide entry next to entries of its collections', async () => {
    const collectionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'tern-sync-'));
    fs.writeFileSync(path.join(collectionPath, 'opencollection.yml'), stringifyCollection({}, { opencollection: '1.0.0', name: 'app', type: 'collection' }));
    fs.mkdirSync(path.join(collectionPath, 'a'));
    await addFolderSyncEntry({ collectionPath, folder: 'a', entry: { sourceUrl: 'https://example.com/a.json', groupBy: 'tags' }, specContent: SPEC });

    registerOpenAPISyncIpc({});
    const [, update] = ipcMain.handle.mock.calls.find(([channel]) => channel === 'renderer:update-openapi-sync-config');

    await expect(update({}, { collectionPath, config: { sourceUrl: 'https://example.com/a.json', autoApply: true } })).rejects.toThrow('per collection');

    const { brunoConfig: saved } = parseCollection(fs.readFileSync(path.join(collectionPath, 'opencollection.yml'), 'utf8'));
    expect(saved.openapi).toHaveLength(1);
  });
});

describe('OpenAPI sync entries follow their collection', () => {
  const { syncEntriesAfterFolderChange } = registerOpenAPISyncIpc;
  const specsDir = path.join(os.tmpdir(), 'specs');
  const readEntries = (collectionPath) => parseCollection(fs.readFileSync(path.join(collectionPath, 'opencollection.yml'), 'utf8')).brunoConfig.openapi;
  const readMetadata = () => JSON.parse(fs.readFileSync(path.join(specsDir, 'metadata.json'), 'utf8'));

  const setup = async (folders) => {
    const collectionPath = fs.mkdtempSync(path.join(os.tmpdir(), 'tern-sync-'));
    fs.writeFileSync(path.join(collectionPath, 'opencollection.yml'), stringifyCollection({}, { opencollection: '1.0.0', name: 'app', type: 'collection' }));
    for (const folder of folders) {
      fs.mkdirSync(path.join(collectionPath, folder), { recursive: true });
      await addFolderSyncEntry({ collectionPath, folder, entry: { sourceUrl: `https://example.com/${folder}.json`, groupBy: 'tags' }, specContent: SPEC });
    }
    return collectionPath;
  };
  const metadataFolders = (collectionPath) => Object.entries(readMetadata())
    .filter(([key]) => key === registerOpenAPISyncIpc._test.specKey(collectionPath))
    .flatMap(([, entries]) => entries.map((entry) => entry.folder)).sort();

  it('rewrites the entry of a renamed collection and of the ones under it, and nothing else', async () => {
    const collectionPath = await setup(['users', 'users/admins', 'users-archive', 'orders']);
    await syncEntriesAfterFolderChange({ collectionPath, oldFolder: 'users', newFolder: 'people' });

    expect(readEntries(collectionPath).map((entry) => entry.folder).sort()).toEqual(['orders', 'people', 'people/admins', 'users-archive']);
    expect(metadataFolders(collectionPath)).toEqual(['orders', 'people', 'people/admins', 'users-archive']);
  });

  it('removes entries, stored specs and metadata of a deleted collection and keeps the others', async () => {
    const collectionPath = await setup(['users', 'users/admins', 'orders']);
    const stored = readMetadata()[registerOpenAPISyncIpc._test.specKey(collectionPath)].filter((entry) => entry.folder.startsWith('users'));
    await syncEntriesAfterFolderChange({ collectionPath, oldFolder: 'users' });

    expect(readEntries(collectionPath).map((entry) => entry.folder)).toEqual(['orders']);
    expect(metadataFolders(collectionPath)).toEqual(['orders']);
    stored.forEach((entry) => expect(fs.existsSync(path.join(specsDir, entry.filename))).toBe(false));
  });

  it('does nothing for a folder without sync entries', async () => {
    const collectionPath = await setup(['orders']);
    await syncEntriesAfterFolderChange({ collectionPath, oldFolder: 'misc', newFolder: 'other' });
    expect(readEntries(collectionPath).map((entry) => entry.folder)).toEqual(['orders']);
  });
});
