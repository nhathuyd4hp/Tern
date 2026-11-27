const fs = require('fs');
const os = require('os');
const path = require('path');
const { ipcMain } = require('electron');
const { writeFileUnique, sanitizeName } = require('../utils/filesystem');
const { fetchRemoteText } = require('./openapi-sync');

const MAX_PROTO_BYTES = 2 * 1024 * 1024;
const TEMP_DIR_PREFIX = 'bruno-proto-';
const PROTOS_DIR = 'protos';

const isHttpUrl = (value) => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};

// The gRPC method loader needs a real file path, so a downloaded proto is staged in an OS temp dir.
const writeTempProto = async (content) => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), TEMP_DIR_PREFIX));
  const tempPath = path.join(dir, 'source.proto');
  await fs.promises.writeFile(tempPath, content, 'utf8');
  return tempPath;
};

const removeTempProto = async (tempPath) => {
  const dir = typeof tempPath === 'string' ? path.dirname(path.resolve(tempPath)) : '';
  const isOurs = path.dirname(dir) === path.resolve(os.tmpdir()) && path.basename(dir).startsWith(TEMP_DIR_PREFIX);
  if (!isOurs) return { success: false };
  await fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  return { success: true };
};

const fetchProtoFile = async ({ collectionUid, collectionPath, sourceUrl, environmentContext }) => {
  try {
    if (!isHttpUrl(sourceUrl)) {
      return { error: 'Invalid URL: only http and https URLs are allowed' };
    }
    const result = await fetchRemoteText(
      { collectionUid, collectionPath, sourceUrl, environmentContext },
      'proto file',
      { maxContentLength: MAX_PROTO_BYTES }
    );
    if (result.error) return { error: result.error };
    if (typeof result.content !== 'string' || !result.content.trim()) {
      return { error: 'The URL did not return a proto file' };
    }
    return { content: result.content, tempPath: await writeTempProto(result.content) };
  } catch (error) {
    return { error: error.message || 'Failed to fetch the proto file' };
  }
};

// Never overwrites: a name collision gets a numeric suffix. The file always lands in <application>/protos.
const saveProtoIntoApplication = async ({ collectionPath, name, content }) => {
  const dir = path.join(collectionPath, PROTOS_DIR);
  await fs.promises.mkdir(dir, { recursive: true });
  const baseName = sanitizeName(path.basename(String(name || ''))) || 'service';
  const { pathname } = await writeFileUnique(dir, baseName, '.proto', content);
  return { pathname };
};

const registerProtoSourceIpc = () => {
  ipcMain.handle('renderer:fetch-proto-file', (event, payload) => fetchProtoFile(payload));
  ipcMain.handle('renderer:remove-temp-proto-file', (event, { tempPath }) => removeTempProto(tempPath));
  ipcMain.handle('renderer:save-proto-into-application', (event, payload) => {
    // required lazily: collection.js registers Electron handlers on load
    require('./collection').validatePathIsInsideCollection(payload.collectionPath);
    return saveProtoIntoApplication(payload);
  });
};

module.exports = registerProtoSourceIpc;
module.exports.fetchProtoFile = fetchProtoFile;
module.exports.removeTempProto = removeTempProto;
module.exports.saveProtoIntoApplication = saveProtoIntoApplication;
