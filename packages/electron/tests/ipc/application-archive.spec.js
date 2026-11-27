const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn(), on: jest.fn() },
  app: { getPath: jest.fn(() => require('os').tmpdir()), getVersion: jest.fn(() => '1.0.0') }
}));

const mockLocation = { current: '' };
jest.mock('../../src/utils/default-location', () => ({
  resolveDefaultLocation: () => mockLocation.current,
  getApplicationsLocation: () => mockLocation.current
}));

const { stringifyCollection, parseCollection } = require('@tern/filestore');
const {
  extractApplicationZip,
  importApplicationZip,
  importApplicationFolder,
  readApplicationFolderName,
  readZipApplicationName
} = require('../../src/ipc/application-archive');

const applicationYml = (name) => stringifyCollection({ meta: { name } }, { opencollection: '1.0.0', name, type: 'collection' });
const nameInYml = (applicationPath) => parseCollection(fs.readFileSync(path.join(applicationPath, 'opencollection.yml'), 'utf8')).brunoConfig.name;

describe('application zip import', () => {
  let workDir;
  let location;

  beforeEach(() => {
    workDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tern-archive-')));
    location = path.join(workDir, 'applications');
    fs.mkdirSync(location);
    mockLocation.current = location;
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  });

  const makeZip = (name, files) => {
    const zip = new AdmZip();
    Object.entries(files).forEach(([entryName, content]) => zip.addFile(entryName, Buffer.from(content)));
    const zipPath = path.join(workDir, name);
    zip.writeZip(zipPath);
    return zipPath;
  };

  it('unpacks an application whose files are at the top of the zip, named after the zip', async () => {
    const zipPath = makeZip('orders.zip', { 'opencollection.yml': 'name: orders', 'users/list.yml': 'x', 'flows.json': '{}' });

    const destination = await extractApplicationZip(zipPath, location);

    expect(destination).toBe(path.join(location, 'orders'));
    expect(fs.readFileSync(path.join(destination, 'users', 'list.yml'), 'utf8')).toBe('x');
    expect(fs.existsSync(path.join(destination, 'flows.json'))).toBe(true);
  });

  it('unpacks an application wrapped in one folder, named after that folder, and drops macOS leftovers', async () => {
    const zipPath = makeZip('download.zip', { 'billing/opencollection.yml': 'name: billing', 'billing/a.yml': 'x', '__MACOSX/._a': 'junk' });

    const destination = await extractApplicationZip(zipPath, location);

    expect(destination).toBe(path.join(location, 'billing'));
    expect(fs.readdirSync(destination).sort()).toEqual(['a.yml', 'opencollection.yml']);
  });

  it('never overwrites: a name already in use gets a number', async () => {
    const zipPath = makeZip('orders.zip', { 'opencollection.yml': 'name: orders' });

    const first = await extractApplicationZip(zipPath, location);
    const second = await extractApplicationZip(zipPath, location);

    expect(second).not.toBe(first);
    expect(fs.existsSync(first)).toBe(true);
    expect(fs.existsSync(second)).toBe(true);
  });

  it('refuses a zip that is not an application, and writes nothing', async () => {
    const zipPath = makeZip('photos.zip', { 'beach.jpg': 'x' });

    await expect(extractApplicationZip(zipPath, location)).rejects.toThrow('not a Tern application');
    expect(fs.readdirSync(location)).toEqual([]);
  });

  it('refuses entries that point outside the new folder, and writes nothing', async () => {
    // AdmZip cleans such a name when it writes a zip, so the zip is made with a placeholder and patched in the bytes.
    const zipPath = makeZip('evil.zip', { 'opencollection.yml': 'name: evil', '__/escaped.txt': 'gotcha' });
    fs.writeFileSync(zipPath, fs.readFileSync(zipPath).toString('latin1').split('__/escaped.txt').join('../escaped.txt'), 'latin1');

    await expect(extractApplicationZip(zipPath, location)).rejects.toThrow('outside the application folder');
    expect(fs.readdirSync(location)).toEqual([]);
    expect(fs.existsSync(path.join(workDir, 'escaped.txt'))).toBe(false);
  });

  it('refuses a file that is not a zip', async () => {
    const filePath = path.join(workDir, 'broken.zip');
    fs.writeFileSync(filePath, 'not a zip');

    await expect(extractApplicationZip(filePath, location)).rejects.toThrow('not a valid zip');
  });

  it('only imports a .zip that exists', async () => {
    await expect(importApplicationZip({}, path.join(workDir, 'missing.zip'))).rejects.toThrow('Choose a .zip file');
    await expect(importApplicationZip({}, path.join(workDir, 'notes.txt'))).rejects.toThrow('Choose a .zip file');
  });

  it('reads the name of the application in a zip without unpacking it, and imports it under a new name', async () => {
    const zipPath = makeZip('download.zip', { 'opencollection.yml': applicationYml('Orders'), 'a.yml': 'x' });

    expect(readZipApplicationName({}, zipPath)).toBe('Orders');
    expect(fs.readdirSync(location)).toEqual([]);

    const imported = await importApplicationZip({}, zipPath, { name: 'Orders 2' });

    expect(imported).toEqual({ path: path.join(location, 'download'), name: 'Orders 2' });
    expect(nameInYml(imported.path)).toBe('Orders 2');
  });

  it('falls back to the folder name when the name cannot be read', async () => {
    const zipPath = makeZip('orders.zip', { 'opencollection.yml': 'not a yml: [' });

    expect(readZipApplicationName({}, zipPath)).toBe('orders');
    expect(await importApplicationZip({}, zipPath)).toMatchObject({ name: 'orders' });
  });

  describe('importing a folder', () => {
    const makeApplication = (parent, folder, name) => {
      const applicationPath = path.join(parent, folder);
      fs.mkdirSync(path.join(applicationPath, '.git'), { recursive: true });
      fs.mkdirSync(path.join(applicationPath, 'node_modules'));
      fs.writeFileSync(path.join(applicationPath, 'opencollection.yml'), applicationYml(name));
      fs.writeFileSync(path.join(applicationPath, 'a.yml'), 'x');
      fs.writeFileSync(path.join(applicationPath, '.git', 'HEAD'), 'ref');
      return applicationPath;
    };

    it('reads the name of the folder application', () => {
      const source = makeApplication(workDir, 'Somewhere', 'Billing');

      expect(readApplicationFolderName({}, source)).toBe('Billing');
      expect(() => readApplicationFolderName({}, workDir)).toThrow('not a Tern application');
    });

    it('copies the folder into the applications location and leaves the source alone', async () => {
      const source = makeApplication(workDir, 'Somewhere', 'Billing');

      const imported = await importApplicationFolder({}, source);

      expect(imported).toEqual({ path: path.join(location, 'Somewhere'), name: 'Billing' });
      expect(fs.readdirSync(imported.path).sort()).toEqual(['a.yml', 'opencollection.yml']);
      expect(fs.existsSync(path.join(source, '.git', 'HEAD'))).toBe(true);
    });

    it('gives a copy a free folder name when one is already there', async () => {
      const source = makeApplication(workDir, 'Somewhere', 'Billing');
      fs.mkdirSync(path.join(location, 'Somewhere'));

      const imported = await importApplicationFolder({}, source);

      expect(imported.path).toBe(path.join(location, 'Somewhere - 1'));
    });

    it('writes a new name into the copy, not into the source', async () => {
      const source = makeApplication(workDir, 'Somewhere', 'Billing');

      const imported = await importApplicationFolder({}, source, { name: 'Billing 2' });

      expect(imported.name).toBe('Billing 2');
      expect(nameInYml(imported.path)).toBe('Billing 2');
      expect(nameInYml(source)).toBe('Billing');
    });

    it('opens a folder that already lives in the applications location in place', async () => {
      const inside = makeApplication(location, 'Billing', 'Billing');

      const imported = await importApplicationFolder({}, inside);

      expect(imported).toEqual({ path: inside, name: 'Billing' });
      expect(fs.readdirSync(location)).toEqual(['Billing']);
    });
  });
});
