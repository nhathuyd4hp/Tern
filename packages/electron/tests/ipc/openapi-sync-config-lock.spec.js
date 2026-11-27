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
const { addFolderSyncEntry } = require('../../src/ipc/openapi-sync');

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
});
