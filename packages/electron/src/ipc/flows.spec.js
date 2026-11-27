const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('electron', () => ({ ipcMain: { handle: jest.fn() } }));

const { readFlows, writeFlows } = require('./flows');

describe('flows ipc', () => {
  let appDir;

  beforeEach(() => {
    appDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flows-spec-'));
  });

  afterEach(() => {
    fs.rmSync(appDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });

  it('has no flows until some are written', async () => {
    expect(await readFlows(appDir)).toBeNull();
  });

  it('writes flows.json in the application folder and reads them back', async () => {
    const flows = [{ id: 'f1', name: 'Login', nodes: [], edges: [] }];

    await writeFlows(appDir, flows);

    const stored = JSON.parse(fs.readFileSync(path.join(appDir, 'flows.json'), 'utf8'));
    expect(stored).toEqual({ version: 1, flows });
    expect(await readFlows(appDir)).toEqual(flows);
    expect(fs.readdirSync(appDir)).toEqual(['flows.json']);
  });

  it('keeps an empty list as a file, which differs from no file', async () => {
    await writeFlows(appDir, []);
    expect(await readFlows(appDir)).toEqual([]);
  });

  it('refuses a file it cannot understand instead of treating it as empty', async () => {
    fs.writeFileSync(path.join(appDir, 'flows.json'), '{not json');
    await expect(readFlows(appDir)).rejects.toThrow();

    fs.writeFileSync(path.join(appDir, 'flows.json'), '{"version":1}');
    await expect(readFlows(appDir)).rejects.toThrow('no flows list');
  });

  it('rejects a relative path and a non-list', async () => {
    await expect(readFlows('relative/app')).rejects.toThrow('Invalid application path');
    await expect(writeFlows(appDir, {})).rejects.toThrow('Flows must be a list');
  });

  it('fails when the application folder is gone, without creating it', async () => {
    const gone = path.join(appDir, 'missing');
    await expect(writeFlows(gone, [])).rejects.toThrow();
    expect(fs.existsSync(gone)).toBe(false);
  });
});
