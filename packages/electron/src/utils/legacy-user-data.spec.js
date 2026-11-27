const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { migrateLegacyUserData } = require('./legacy-user-data');

describe('migrateLegacyUserData', () => {
  let appData;
  let userData;

  beforeEach(() => {
    appData = fs.mkdtempSync(path.join(os.tmpdir(), 'tern-appdata-'));
    userData = path.join(appData, 'tern');
  });

  const writeLegacy = (relativePath, content, appName = 'bruno') => {
    const file = path.join(appData, appName, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  };

  it('copies the previous data on the first start and leaves the old directory intact', () => {
    writeLegacy('preferences.json', '{"a":1}');
    writeLegacy(path.join('default-workspace', 'workspace.yml'), 'name: test');
    writeLegacy(path.join('Cache', 'big.bin'), 'cache');

    expect(migrateLegacyUserData({ userDataPath: userData, appDataPath: appData })).toBe(true);

    expect(fs.readFileSync(path.join(userData, 'preferences.json'), 'utf8')).toBe('{"a":1}');
    expect(fs.existsSync(path.join(userData, 'default-workspace', 'workspace.yml'))).toBe(true);
    expect(fs.existsSync(path.join(userData, 'Cache'))).toBe(false);
    expect(fs.existsSync(path.join(appData, 'bruno', 'preferences.json'))).toBe(true);
  });

  it('prefers the data of the newest previous name', () => {
    writeLegacy('preferences.json', 'from-bruno');
    writeLegacy('preferences.json', 'from-kevin', 'kevin');

    expect(migrateLegacyUserData({ userDataPath: userData, appDataPath: appData })).toBe(true);
    expect(fs.readFileSync(path.join(userData, 'preferences.json'), 'utf8')).toBe('from-kevin');
  });

  it('does nothing when the new directory already has data', () => {
    writeLegacy('preferences.json', 'old');
    fs.mkdirSync(userData, { recursive: true });
    fs.writeFileSync(path.join(userData, 'preferences.json'), 'new');

    expect(migrateLegacyUserData({ userDataPath: userData, appDataPath: appData })).toBe(false);
    expect(fs.readFileSync(path.join(userData, 'preferences.json'), 'utf8')).toBe('new');
  });

  it('does nothing when there is no previous data', () => {
    expect(migrateLegacyUserData({ userDataPath: userData, appDataPath: appData })).toBe(false);
  });
});
