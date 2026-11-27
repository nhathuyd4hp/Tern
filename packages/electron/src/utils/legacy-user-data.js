const fs = require('node:fs');
const path = require('node:path');

// Earlier names of the app, newest first: its data lives in <appData>/<name>.
const LEGACY_APP_NAMES = ['kevin', 'bruno'];

// Chromium caches are rebuilt on demand; copying them only slows the first start.
const SKIPPED_ENTRIES = new Set([
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
  'Crashpad',
  'blob_storage',
  'Service Worker',
  'logs',
  'SingletonLock',
  'SingletonCookie',
  'SingletonSocket',
  'lockfile'
]);

const isEmptyDirectory = (dir) => !fs.existsSync(dir) || fs.readdirSync(dir).length === 0;

/**
 * The app used to have other names, so its data (preferences, default workspace, stored specs, ...) lives in
 * <appData>/<old name>. On the first start under the current name, copy the newest of those into the new userData
 * directory.
 * The old directory is never modified, so nothing is lost if the copy fails half way.
 *
 * @returns {boolean} true when data was copied
 */
const migrateLegacyUserData = ({ userDataPath, appDataPath }) => {
  if (!isEmptyDirectory(userDataPath)) return false;

  const legacyPath = LEGACY_APP_NAMES
    .map((name) => path.join(appDataPath, name))
    .find((candidate) => path.resolve(candidate) !== path.resolve(userDataPath) && !isEmptyDirectory(candidate));
  if (!legacyPath) return false;

  try {
    fs.cpSync(legacyPath, userDataPath, {
      recursive: true,
      filter: (source) => !SKIPPED_ENTRIES.has(path.basename(source))
    });
    return true;
  } catch (error) {
    console.error('Could not copy the data of the previous app name:', error);
    return false;
  }
};

module.exports = { migrateLegacyUserData };
