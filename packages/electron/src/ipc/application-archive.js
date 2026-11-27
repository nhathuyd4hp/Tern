const fs = require('node:fs');
const path = require('node:path');
const AdmZip = require('adm-zip');
const { ipcMain } = require('electron');
const { sanitizeName } = require('../utils/filesystem');
const { findUniqueFolderName } = require('../utils/collection-import');
const { parseCollection, stringifyCollection } = require('@tern/filestore');
const { getApplicationsLocation } = require('../utils/default-location');

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

// The name an application shows is the one in its opencollection.yml; a file that cannot be read has none.
const parseApplicationName = (content) => {
  try {
    return parseCollection(content).brunoConfig.name || null;
  } catch {
    return null;
  }
};

const readApplicationName = (applicationPath) => {
  const markerPath = path.join(applicationPath, APPLICATION_MARKER);
  const name = fs.existsSync(markerPath) ? parseApplicationName(fs.readFileSync(markerPath, 'utf8')) : null;
  return name || path.basename(applicationPath);
};

const writeApplicationName = (applicationPath, name) => {
  const markerPath = path.join(applicationPath, APPLICATION_MARKER);
  const { brunoConfig, collectionRoot } = parseCollection(fs.readFileSync(markerPath, 'utf8'));
  brunoConfig.name = name;
  fs.writeFileSync(markerPath, stringifyCollection(collectionRoot, brunoConfig));
};

const assertZipPath = (zipFilePath) => {
  if (typeof zipFilePath !== 'string' || path.extname(zipFilePath).toLowerCase() !== '.zip' || !fs.existsSync(zipFilePath)) {
    throw new Error('Choose a .zip file to import');
  }
};

// The name of the application inside a zip, read without unpacking it, so a name already in use is found first.
const readZipApplicationName = (event, zipFilePath) => {
  assertZipPath(zipFilePath);
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
  const marker = entries.find((entry) => toEntryPath(entry) === `${prefix}${APPLICATION_MARKER}`);
  const fallback = prefix ? prefix.slice(0, -1) : path.basename(zipFilePath, path.extname(zipFilePath));
  return parseApplicationName(marker.getData().toString('utf8')) || fallback;
};

/** Unpack the zip into the applications location. `options.name` renames the new application. */
const importApplicationZip = async (event, zipFilePath, options = {}) => {
  assertZipPath(zipFilePath);
  const destination = await extractApplicationZip(zipFilePath, getApplicationsLocation());
  if (options.name) {
    writeApplicationName(destination, options.name);
  }
  return { path: destination, name: options.name || readApplicationName(destination) };
};

const isInside = (folderPath, parentPath) => {
  const relative = path.relative(parentPath, folderPath);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
};

const assertApplicationFolder = (folderPath) => {
  if (typeof folderPath !== 'string' || !fs.existsSync(path.join(folderPath, APPLICATION_MARKER))) {
    throw new Error(`This folder is not a Tern application: it has no ${APPLICATION_MARKER}`);
  }
};

const readApplicationFolderName = (event, folderPath) => {
  assertApplicationFolder(folderPath);
  return readApplicationName(folderPath);
};

/**
 * Bring an application folder into the applications location. The source is only copied, never moved or deleted;
 * one that already lives in the location is used in place. `options.name` renames the application.
 */
const importApplicationFolder = async (event, folderPath, options = {}) => {
  assertApplicationFolder(folderPath);
  const location = getApplicationsLocation();
  let destination = folderPath;
  if (!isInside(path.resolve(folderPath), path.resolve(location))) {
    const folderName = await findUniqueFolderName(path.basename(folderPath), location);
    destination = path.join(location, sanitizeName(folderName));
    try {
      fs.cpSync(folderPath, destination, {
        recursive: true,
        filter: (source) => !['.git', 'node_modules'].includes(path.basename(source))
      });
    } catch (error) {
      removeFolder(destination);
      throw error;
    }
  }
  if (options.name) {
    writeApplicationName(destination, options.name);
  }
  return { path: destination, name: options.name || readApplicationName(destination) };
};

const registerApplicationArchiveIpc = () => {
  ipcMain.handle('renderer:read-application-zip-name', readZipApplicationName);
  ipcMain.handle('renderer:import-application-zip', importApplicationZip);
  ipcMain.handle('renderer:read-application-folder-name', readApplicationFolderName);
  ipcMain.handle('renderer:import-application-folder', importApplicationFolder);
};

module.exports = registerApplicationArchiveIpc;
module.exports.extractApplicationZip = extractApplicationZip;
module.exports.importApplicationZip = importApplicationZip;
module.exports.readZipApplicationName = readZipApplicationName;
module.exports.importApplicationFolder = importApplicationFolder;
module.exports.readApplicationFolderName = readApplicationFolderName;
