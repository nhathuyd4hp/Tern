const fs = require('fs');
const os = require('os');
const path = require('path');

jest.mock('electron', () => ({ ipcMain: { handle: jest.fn() } }));
jest.mock('./openapi-sync', () => ({ fetchRemoteText: jest.fn() }));

const { fetchRemoteText } = require('./openapi-sync');
const { fetchProtoFile, removeTempProto, saveProtoIntoApplication } = require('./proto-source');

describe('proto-source', () => {
  let appDir;

  beforeEach(() => {
    appDir = fs.mkdtempSync(path.join(os.tmpdir(), 'proto-source-spec-'));
    fetchRemoteText.mockReset();
  });

  afterEach(() => {
    fs.rmSync(appDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });

  describe('saveProtoIntoApplication', () => {
    it('writes into <application>/protos and never overwrites', async () => {
      const first = await saveProtoIntoApplication({ collectionPath: appDir, name: 'svc', content: 'a' });
      const second = await saveProtoIntoApplication({ collectionPath: appDir, name: 'svc', content: 'b' });

      expect(first.pathname).toBe(path.join(appDir, 'protos', 'svc.proto'));
      expect(second.pathname).not.toBe(first.pathname);
      expect(path.dirname(second.pathname)).toBe(path.join(appDir, 'protos'));
      expect(fs.readFileSync(first.pathname, 'utf8')).toBe('a');
      expect(fs.readFileSync(second.pathname, 'utf8')).toBe('b');
    });

    it('keeps a traversal name inside the protos folder', async () => {
      const { pathname } = await saveProtoIntoApplication({ collectionPath: appDir, name: '../../evil', content: 'x' });
      expect(path.dirname(pathname)).toBe(path.join(appDir, 'protos'));
    });

    it('falls back to a default name', async () => {
      const { pathname } = await saveProtoIntoApplication({ collectionPath: appDir, name: '', content: 'x' });
      expect(path.basename(pathname)).toBe('service.proto');
    });
  });

  describe('fetchProtoFile', () => {
    it('rejects non http(s) URLs without fetching', async () => {
      const result = await fetchProtoFile({ sourceUrl: 'file:///etc/passwd' });
      expect(result.error).toMatch(/only http and https/);
      expect(fetchRemoteText).not.toHaveBeenCalled();
    });

    it('surfaces fetch errors and empty bodies', async () => {
      fetchRemoteText.mockResolvedValueOnce({ error: 'Failed to fetch proto file: 404 Not Found' });
      expect((await fetchProtoFile({ sourceUrl: 'https://x.test/a.proto' })).error).toMatch(/404/);

      fetchRemoteText.mockResolvedValueOnce({ content: '  ' });
      expect((await fetchProtoFile({ sourceUrl: 'https://x.test/a.proto' })).error).toMatch(/did not return/);
    });

    it('stages the content in a temp file that removeTempProto deletes', async () => {
      fetchRemoteText.mockResolvedValueOnce({ content: 'syntax = "proto3";' });
      const { content, tempPath } = await fetchProtoFile({ sourceUrl: 'https://x.test/a.proto' });

      expect(fs.readFileSync(tempPath, 'utf8')).toBe(content);
      expect(await removeTempProto(tempPath)).toEqual({ success: true });
      expect(fs.existsSync(path.dirname(tempPath))).toBe(false);
    });
  });

  describe('removeTempProto', () => {
    it('refuses paths outside its own temp dirs', async () => {
      const file = path.join(appDir, 'keep.proto');
      fs.writeFileSync(file, 'x');
      expect(await removeTempProto(file)).toEqual({ success: false });
      expect(fs.existsSync(file)).toBe(true);
    });
  });
});
