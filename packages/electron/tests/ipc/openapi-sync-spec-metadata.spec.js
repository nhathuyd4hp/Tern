const fs = require('fs');
const os = require('os');
const path = require('path');

const mockUserData = fs.mkdtempSync(path.join(os.tmpdir(), 'tern-userdata-'));
jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn(), on: jest.fn() },
  app: { getPath: jest.fn(() => mockUserData), getVersion: jest.fn(() => '1.0.0') }
}));

const { _test } = require('../../src/ipc/openapi-sync');

describe('spec metadata keys', () => {
  it('treats both slash spellings of one path as the same key', () => {
    expect(_test.specKey('C:\\Apps\\Zin\\')).toBe(_test.specKey('C:/Apps/Zin'));
  });

  it('merges the entries stored under both spellings and keeps the copy written last', () => {
    const specs = path.join(mockUserData, 'specs');
    fs.mkdirSync(specs, { recursive: true });
    const write = (name, secondsAgo) => {
      const file = path.join(specs, name);
      fs.writeFileSync(file, '{}');
      const time = new Date(Date.now() - secondsAgo * 1000);
      fs.utimesSync(file, time, time);
    };
    write('old.json', 100);
    write('new.json', 1);

    const merged = _test.canonicalizeSpecMetadata({
      'C:\\Apps\\Zin': [{ filename: 'old.json', folder: 'Zin' }],
      'C:/Apps/Zin': [{ filename: 'new.json', folder: 'Zin' }, { filename: 'other.json' }]
    });

    expect(Object.keys(merged)).toEqual([_test.specKey('C:/Apps/Zin')]);
    expect(merged[_test.specKey('C:/Apps/Zin')].map((entry) => entry.filename).sort()).toEqual(['new.json', 'other.json']);
  });
});
