const fs = require('node:fs');
const { app } = require('electron');

/**
 * Returns the default location where new applications are stored: the app's data directory
 * (%APPDATA%\tern on Windows). It is deliberately not under the user's Documents folder.
 */
function resolveDefaultLocation() {
  const dirPath = app.getPath('userData');
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
}

module.exports = { resolveDefaultLocation };
