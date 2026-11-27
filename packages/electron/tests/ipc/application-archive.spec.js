const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn(), on: jest.fn() },
  app: { getPath: jest.fn(() => require('os').tmpdir()), getVersion: jest.fn(() => '1.0.0') }
}));

const { extractApplicationZip, importApplicationZip } = require('../../src/ipc/application-archive');

describe('application zip import', () => {
  let workDir;
  let location;

  beforeEach(() => {
    workDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'tern-archive-')));
    location = path.join(workDir, 'applications');
    fs.mkdirSync(location);
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
});
