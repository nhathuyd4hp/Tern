const fs = require('node:fs');
const path = require('node:path');
const { getFilenameWithFormat } = require('@tern/common/utils');
const { stringifyRequestViaWorker, stringifyFolder } = require('@tern/filestore');
const { sanitizeName, writeFileUnique, mkdirUnique, writeFile, posixifyPath } = require('./filesystem');

const REQUEST_TYPES = ['http-request', 'graphql-request', 'grpc-request', 'ws-request'];

const isInside = (target, parent) => {
  const relative = path.relative(path.resolve(parent), path.resolve(target));
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
};

/**
 * Writes converted items (requests and nested folders) into an existing folder of an application.
 * Existing files and folders are never overwritten: colliding names get a numeric suffix.
 *
 * @returns {Promise<number>} how many requests were written
 */
const writeItemsIntoFolder = async ({ items, folderPath, collectionPath }) => {
  if (!isInside(folderPath, collectionPath)) {
    throw new Error('The target collection must be inside the application');
  }
  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    throw new Error('The target collection does not exist');
  }

  let written = 0;

  const writeLevel = async (levelItems, currentPath) => {
    const requests = levelItems.filter((item) => REQUEST_TYPES.includes(item.type));
    const contents = await Promise.all(requests.map((item) => stringifyRequestViaWorker(item)));
    for (const [index, item] of requests.entries()) {
      const filename = sanitizeName(getFilenameWithFormat(item, 'yml'));
      await writeFileUnique(currentPath, filename.replace(/\.yml$/, ''), 'yml', contents[index]);
      written++;
    }

    for (const item of levelItems.filter((entry) => entry.type === 'folder')) {
      const { pathname } = await mkdirUnique(currentPath, sanitizeName(item.filename || item.name));
      if (item.root?.meta?.name) {
        const root = { ...item.root, meta: { ...item.root.meta, seq: item.seq } };
        await writeFile(path.join(pathname, 'folder.yml'), await stringifyFolder(root));
      }
      await writeLevel(item.items || [], pathname);
    }
  };

  await writeLevel(items || [], folderPath);
  return written;
};

/**
 * Imports converted items into a folder and, when the folder comes from an OpenAPI spec, connects the folder
 * to that spec (`openapiSync: { entry, specContent }`). Returns the folder path relative to the application.
 */
const importItemsIntoFolder = async ({ collectionPath, folderPath, items, openapiSync }) => {
  const count = await writeItemsIntoFolder({ items, folderPath, collectionPath });
  const folder = posixifyPath(path.relative(collectionPath, folderPath));

  if (openapiSync) {
    // required lazily: openapi-sync registers Electron handlers on load
    const { addFolderSyncEntry } = require('../ipc/openapi-sync');
    await addFolderSyncEntry({ collectionPath, folder, entry: openapiSync.entry, specContent: openapiSync.specContent });
  }

  return { count, folder };
};

module.exports = { writeItemsIntoFolder, importItemsIntoFolder };
