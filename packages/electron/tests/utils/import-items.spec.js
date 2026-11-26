const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

jest.mock('@usebruno/filestore', () => ({
  stringifyRequestViaWorker: jest.fn(async (item) => `request ${item.name}`),
  stringifyFolder: jest.fn(async (root) => `folder ${root.meta.name}`)
}));

const { writeItemsIntoFolder } = require('../../src/utils/import-items');

const request = (name) => ({ type: 'http-request', name, request: { method: 'GET', url: '/a' } });

describe('writeItemsIntoFolder', () => {
  let app;
  let folder;

  beforeEach(() => {
    app = fs.mkdtempSync(path.join(os.tmpdir(), 'import-items-'));
    folder = path.join(app, 'Pets');
    fs.mkdirSync(folder);
  });

  afterEach(() => fs.rmSync(app, { recursive: true, force: true }));

  it('writes requests and nested folders inside the target folder', async () => {
    const items = [
      request('list'),
      { type: 'folder', name: 'pets tag', seq: 1, root: { meta: { name: 'pets tag' } }, items: [request('get')] }
    ];

    const count = await writeItemsIntoFolder({ items, folderPath: folder, collectionPath: app, format: 'yml' });

    expect(count).toBe(2);
    expect(fs.readdirSync(folder).sort()).toEqual(['list.yml', 'pets tag']);
    expect(fs.readdirSync(path.join(folder, 'pets tag')).sort()).toEqual(['folder.yml', 'get.yml']);
  });

  it('keeps existing files and gives colliding names a suffix', async () => {
    fs.writeFileSync(path.join(folder, 'list.yml'), 'mine');

    await writeItemsIntoFolder({ items: [request('list'), request('list')], folderPath: folder, collectionPath: app, format: 'yml' });

    expect(fs.readFileSync(path.join(folder, 'list.yml'), 'utf8')).toBe('mine');
    expect(fs.readdirSync(folder)).toHaveLength(3);
  });

  it('rejects a folder outside the application and the application root itself', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-'));
    await expect(writeItemsIntoFolder({ items: [], folderPath: outside, collectionPath: app, format: 'yml' })).rejects.toThrow(/inside the application/);
    await expect(writeItemsIntoFolder({ items: [], folderPath: app, collectionPath: app, format: 'yml' })).rejects.toThrow(/inside the application/);
    fs.rmSync(outside, { recursive: true, force: true });
  });
});
