const fs = require('node:fs');
const path = require('node:path');
const AdmZip = require('adm-zip');
const { ipcMain } = require('electron');
const { sanitizeName } = require('../utils/filesystem');
const { findUniqueFolderName } = require('../utils/collection-import');
const { resolveDefaultLocation } = require('../utils/default-location');

const APPLICATION_MARKER = 'opencollection.yml';
const MAX_ENTRIES = 50000;
const MAX_UNPACKED_BYTES = 2 * 1024 * 1024 * 1024;

const toEntryPath = (entry) => entry.entryName.replace(/\\/g, '/');

// Tern exports an application with its files at the root of the zip. A zip made by hand usually has one
// folder around them, so both layouts are accepted. Returns the folder prefix ('' for the root) or null.
const findApplicationPrefix = (entryPaths) => {
  if (entryPaths.includes(APPLICATION_MARKER)) {
    return '';
  }
  const wrapped = entryPaths.find((entryPath) => /^[^/]+\/opencollection\.yml$/.test(entryPath));
  return wrapped ? wrapped.slice(0, wrapped.indexOf('/') + 1) : null;
};

const removeFolder = (folderPath) => fs.rmSync(folderPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });

/**
 * Unpack an application zip into a new folder under `location` and return its path. Nothing is overwritten:
 * a name already in use gets a number added. A zip that is not an application, has entries pointing outside the
 * new folder, or is unreasonably large is refused before anything is written.
 */
const extractApplicationZip = async (zipFilePath, location) => {
  let zip;
  try {
    zip = new AdmZip(zipFilePath);
  } catch {
    throw new Error('This file is not a valid zip');
  }

  const entries = zip.getEntries().filter((entry) => !toEntryPath(entry).startsWith('__MACOSX/'));
  const prefix = findApplicationPrefix(entries.map(toEntryPath));
  if (prefix === null) {
    throw new Error(`This zip is not a Tern application: it has no ${APPLICATION_MARKER} at its top level`);
  }
  if (entries.length > MAX_ENTRIES) {
    throw new Error('This zip has too many files to import');
  }

  const files = entries.filter((entry) => toEntryPath(entry).startsWith(prefix));
  if (files.reduce((total, entry) => total + entry.header.size, 0) > MAX_UNPACKED_BYTES) {
    throw new Error('This zip is too large to import');
  }

  const baseName = prefix ? prefix.slice(0, -1) : path.basename(zipFilePath, path.extname(zipFilePath));
  const folderName = await findUniqueFolderName(baseName, location);
  const destination = path.join(location, sanitizeName(folderName));

  const targets = files.map((entry) => {
    const target = path.resolve(destination, toEntryPath(entry).slice(prefix.length));
    if (target !== destination && !target.startsWith(destination + path.sep)) {
      throw new Error('This zip has files that point outside the application folder');
    }
    return { entry, target };
  });

  try {
    fs.mkdirSync(destination, { recursive: true });
    for (const { entry, target } of targets) {
      if (entry.isDirectory) {
        fs.mkdirSync(target, { recursive: true });
      } else {
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, entry.getData());
      }
    }
  } catch (error) {
    removeFolder(destination);
    throw error;
  }

  return destination;
};

const importApplicationZip = async (event, zipFilePath) => {
  if (typeof zipFilePath !== 'string' || path.extname(zipFilePath).toLowerCase() !== '.zip' || !fs.existsSync(zipFilePath)) {
    throw new Error('Choose a .zip file to import');
  }
  return { path: await extractApplicationZip(zipFilePath, resolveDefaultLocation()) };
};

const registerApplicationArchiveIpc = () => {
  ipcMain.handle('renderer:import-application-zip', importApplicationZip);
};

module.exports = registerApplicationArchiveIpc;
module.exports.extractApplicationZip = extractApplicationZip;
module.exports.importApplicationZip = importApplicationZip;
