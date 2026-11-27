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

/**
 * The one place every application lives: the default location of Settings (Preferences > General),
 * or the data directory when that one is not set or does not exist anymore.
 */
function getApplicationsLocation() {
  const { getPreferences } = require('../store/preferences');
  const location = getPreferences().general?.defaultLocation;
  return location && fs.existsSync(location) && fs.statSync(location).isDirectory() ? location : resolveDefaultLocation();
}

module.exports = { resolveDefaultLocation, getApplicationsLocation };
