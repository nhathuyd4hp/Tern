const fs = require('node:fs/promises');
const path = require('node:path');
const { parseCollection } = require('@tern/filestore');
const { validateSchema } = require('../../app/collections');

const MAX_CONFIG_BYTES = 1024 * 1024;

const CONFIG_FILE = 'opencollection.yml';

const readCollectionConfig = async (collectionPath) => {
  const folderName = path.basename(collectionPath);
  try {
    const filePath = path.join(collectionPath, CONFIG_FILE);
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return { name: folderName, isBroken: true };
    }
    if (stats.size > MAX_CONFIG_BYTES) {
      return { name: folderName, isBroken: false };
    }
    const { brunoConfig: config } = parseCollection(await fs.readFile(filePath, 'utf8'));
    await validateSchema(config);
    return { name: String(config.name), isBroken: false };
  } catch (error) {
    return { name: folderName, isBroken: true };
  }
};

module.exports = {
  readCollectionConfig
};
