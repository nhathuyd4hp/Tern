const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { writeFile, validateName, isValidCollectionDirectory } = require('./filesystem');
const { generateUidBasedOnHash } = require('./common');
const { withLock, getWorkspaceLockKey } = require('./workspace-lock');

// Normalize Windows backslash paths to forward slashes for cross-platform compatibility.
const posixifyPath = (p) => (p ? p.replace(/\\/g, '/') : p);

const WORKSPACE_TYPE = 'workspace';
const OPENCOLLECTION_VERSION = '1.0.0';

const YAML_NAMED_ESCAPES = {
  '\\': '\\\\',
  '"': '\\"',
  '\n': '\\n',
  '\r': '\\r',
  '\t': '\\t'
};

const quoteYamlValue = (value) => {
  if (typeof value !== 'string') {
    return `"${String(value)}"`;
  }

  if (value === '') {
    return '""';
  }

  // Values are written inside double quotes. A raw line break would be read back as a space,
  // and other raw control characters stop workspace.yml from loading, so each one is written
  // as an escape code (\n, \t, \x01) instead.
  const escaped = value.replace(
    /[\\"\u0000-\u001f\u007f-\u009f]/g,
    (char) => YAML_NAMED_ESCAPES[char] || `\\x${char.charCodeAt(0).toString(16).padStart(2, '0')}`
  );

  return `"${escaped}"`;
};

const writeWorkspaceFileAtomic = async (workspacePath, content) => {
  const workspaceFilePath = path.join(workspacePath, 'workspace.yml');
  await writeFile(workspaceFilePath, content);

  // Previous atomic write implementation commented out due to permission issues on Linux
  // when temp directory is on a different filesystem (cross-device link error)

  // const tempFilePath = path.join(os.tmpdir(), `workspace-${Date.now()}-${crypto.randomBytes(16).toString('hex')}.yml`);

  // try {
  //   await writeFile(tempFilePath, content);

  //   if (fs.existsSync(workspaceFilePath)) {
  //     fs.unlinkSync(workspaceFilePath);
  //   }

  //   fs.renameSync(tempFilePath, workspaceFilePath);
  // } catch (error) {
  //   if (fs.existsSync(tempFilePath)) {
  //     try {
  //       fs.unlinkSync(tempFilePath);
  //     } catch (_) {}
  //   }
  //   throw error;
  // }
};

const isValidCollectionEntry = (collection) => {
  if (!collection || typeof collection !== 'object') {
    return false;
  }

  if (!collection.name || typeof collection.name !== 'string' || collection.name.trim() === '') {
    return false;
  }

  if (!collection.path || typeof collection.path !== 'string' || collection.path.trim() === '') {
    return false;
  }

  return true;
};

const sanitizeCollections = (collections) => {
  if (!Array.isArray(collections)) {
    return [];
  }

  return collections.filter((collection) => {
    if (!isValidCollectionEntry(collection)) {
      console.error('Skipping invalid collection entry:', collection);
      return false;
    }
    return true;
  }).map((collection) => {
    const sanitized = {
      name: collection.name.trim(),
      path: posixifyPath(collection.path.trim())
    };

    if (collection.remote && typeof collection.remote === 'string') {
      sanitized.remote = collection.remote.trim();
    }

    return sanitized;
  });
};

const makeRelativePath = (workspacePath, absolutePath) => {
  if (!path.isAbsolute(absolutePath)) {
    return posixifyPath(absolutePath);
  }

  try {
    const relativePath = path.relative(workspacePath, absolutePath);
    if (relativePath.startsWith('..') && relativePath.split(path.sep).filter((s) => s === '..').length > 2) {
      return posixifyPath(absolutePath);
    }
    return posixifyPath(relativePath);
  } catch (error) {
    return posixifyPath(absolutePath);
  }
};

const getNormalizedAbsoluteCollectionPath = (workspacePath, collection) => {
  if (!collection?.path) return null;
  const resolved = path.isAbsolute(collection.path) ? collection.path : path.resolve(workspacePath, collection.path);
  return path.normalize(resolved);
};

const normalizeCollectionEntry = (workspacePath, collection) => {
  const relativePath = makeRelativePath(workspacePath, collection.path);

  const normalizedCollection = {
    name: collection.name,
    path: relativePath
  };

  if (collection.remote) {
    normalizedCollection.remote = collection.remote;
  }

  return normalizedCollection;
};

const validateWorkspacePath = (workspacePath) => {
  if (!workspacePath) {
    throw new Error('Workspace path is required');
  }

  if (!fs.existsSync(workspacePath)) {
    throw new Error(`Workspace path does not exist: ${workspacePath}`);
  }

  const workspaceFilePath = path.join(workspacePath, 'workspace.yml');
  if (!fs.existsSync(workspaceFilePath)) {
    throw new Error('Invalid workspace: workspace.yml not found');
  }

  return true;
};

const normalizeWorkspaceConfig = (config) => ({
  ...config,
  name: config.info?.name,
  type: config.info?.type,
  collections: config.collections || []
});

const readWorkspaceConfig = (workspacePath) => {
  const workspaceFilePath = path.join(workspacePath, 'workspace.yml');

  if (!fs.existsSync(workspaceFilePath)) {
    throw new Error('Invalid workspace: workspace.yml not found');
  }

  const yamlContent = fs.readFileSync(workspaceFilePath, 'utf8');
  const workspaceConfig = yaml.load(yamlContent);

  if (!workspaceConfig || typeof workspaceConfig !== 'object') {
    throw new Error('Invalid workspace: workspace.yml is malformed');
  }

  return normalizeWorkspaceConfig(workspaceConfig);
};

const generateYamlContent = (config) => {
  const yamlLines = [];
  const workspaceName = config.info?.name || config.name || 'Untitled Workspace';
  const workspaceType = config.info?.type || config.type || WORKSPACE_TYPE;

  yamlLines.push(`opencollection: ${config.opencollection || OPENCOLLECTION_VERSION}`);
  yamlLines.push('info:');
  yamlLines.push(`  name: ${quoteYamlValue(workspaceName)}`);
  yamlLines.push(`  type: ${workspaceType}`);
  yamlLines.push('');

  const collections = sanitizeCollections(config.collections);
  if (collections.length > 0) {
    yamlLines.push('collections:');
    for (const collection of collections) {
      yamlLines.push(`  - name: ${quoteYamlValue(collection.name)}`);
      yamlLines.push(`    path: ${quoteYamlValue(collection.path)}`);
      if (collection.remote) {
        yamlLines.push(`    remote: ${quoteYamlValue(collection.remote)}`);
      }
    }
  } else {
    yamlLines.push('collections:');
  }
  yamlLines.push('');

  const docs = config.docs || '';
  if (docs) {
    const escapedDocs = docs.includes('\n')
      ? `|-\n  ${docs.split('\n').join('\n  ')}`
      : quoteYamlValue(docs);
    yamlLines.push(`docs: ${escapedDocs}`);
  } else {
    yamlLines.push('docs: \'\'');
  }

  yamlLines.push('');

  return yamlLines.join('\n');
};

const writeWorkspaceConfig = async (workspacePath, config) => {
  return withLock(getWorkspaceLockKey(workspacePath), async () => {
    const yamlContent = generateYamlContent(config);
    await writeWorkspaceFileAtomic(workspacePath, yamlContent);
  });
};

const validateWorkspaceConfig = (config) => {
  if (!config || typeof config !== 'object') {
    throw new Error('Workspace configuration must be an object');
  }

  const type = config.info?.type || config.type;
  if (type !== WORKSPACE_TYPE) {
    throw new Error('Invalid workspace: not a bruno workspace');
  }

  const name = config.info?.name || config.name;
  if (!name || typeof name !== 'string') {
    throw new Error('Workspace must have a valid name');
  }

  return true;
};

const addCollectionToWorkspace = async (workspacePath, collection) => {
  if (!isValidCollectionEntry(collection)) {
    throw new Error('Invalid collection: name and path are required');
  }

  return withLock(getWorkspaceLockKey(workspacePath), async () => {
    const config = readWorkspaceConfig(workspacePath);

    if (!config.collections) {
      config.collections = [];
    }

    const normalizedCollection = {
      name: collection.name.trim(),
      path: posixifyPath(collection.path.trim())
    };

    if (collection.remote && typeof collection.remote === 'string') {
      normalizedCollection.remote = collection.remote.trim();
    }

    const existingIndex = config.collections.findIndex((c) => c.path && posixifyPath(c.path) === normalizedCollection.path);

    if (existingIndex >= 0) {
      config.collections[existingIndex] = normalizedCollection;
    } else {
      config.collections.push(normalizedCollection);
    }

    const yamlContent = generateYamlContent(config);
    await writeWorkspaceFileAtomic(workspacePath, yamlContent);
    return config.collections;
  });
};

const removeCollectionFromWorkspace = async (workspacePath, collectionPath) => {
  return withLock(getWorkspaceLockKey(workspacePath), async () => {
    const config = readWorkspaceConfig(workspacePath);

    let removedCollection = null;

    config.collections = (config.collections || []).filter((c) => {
      const collectionPathFromYml = c.path ? posixifyPath(c.path) : c.path;

      if (!collectionPathFromYml) {
        return true;
      }

      const absoluteCollectionPath = path.isAbsolute(collectionPathFromYml)
        ? collectionPathFromYml
        : path.resolve(workspacePath, collectionPathFromYml);

      if (path.normalize(absoluteCollectionPath) === path.normalize(collectionPath)) {
        removedCollection = c;
        return false;
      }

      return true;
    });

    const yamlContent = generateYamlContent(config);
    await writeWorkspaceFileAtomic(workspacePath, yamlContent);

    return {
      removedCollection,
      updatedConfig: config
    };
  });
};

/**
 * Reorders the collections array in the workspace's workspace.yml to match the given path list.
 * Entries not in the list are appended at the end.
 * @param {string} workspacePath - Absolute path to the workspace directory
 * @param {string[]} collectionPaths - Absolute collection pathnames in the desired order
 */
const reorderWorkspaceCollections = async (workspacePath, collectionPaths) => {
  if (!Array.isArray(collectionPaths)) {
    throw new Error('collectionPaths must be an array');
  }

  return withLock(getWorkspaceLockKey(workspacePath), async () => {
    const config = readWorkspaceConfig(workspacePath);
    const existing = config.collections || [];

    const inNewOrder = [];
    const matched = new Set();

    for (const absolutePath of collectionPaths) {
      const targetPath = posixifyPath(path.normalize(absolutePath));
      const entry = existing.find(
        (c) => posixifyPath(getNormalizedAbsoluteCollectionPath(workspacePath, c)) === targetPath
      );
      if (entry && !matched.has(entry)) {
        inNewOrder.push(entry);
        matched.add(entry);
      }
    }

    const notInList = existing.filter((c) => !matched.has(c));
    config.collections = [...inNewOrder, ...notInList];

    const yamlContent = generateYamlContent(config);
    await writeWorkspaceFileAtomic(workspacePath, yamlContent);
  });
};

const resolveWorkspaceCollectionPaths = (workspacePath, rawCollections) => {
  const seenPaths = new Set();

  return (rawCollections || [])
    .map((collection) => {
      if (!collection.path) return collection;
      const collectionPath = posixifyPath(collection.path);
      const absolute = path.isAbsolute(collectionPath)
        ? collectionPath
        : path.resolve(workspacePath, collectionPath);
      return { ...collection, path: absolute };
    })
    .filter((collection) => {
      if (!collection.path) return false;
      const normalizedPath = path.normalize(collection.path);
      if (seenPaths.has(normalizedPath)) return false;
      seenPaths.add(normalizedPath);
      return true;
    });
};

const resolveAndFilterWorkspaceCollections = (workspacePath, rawCollections) => {
  return resolveWorkspaceCollectionPaths(workspacePath, rawCollections)
    .map((collection) => {
      if (isValidCollectionDirectory(collection.path)) return collection;
      if (collection.remote) return { ...collection, notFoundLocally: true };
      return null;
    })
    .filter(Boolean);
};

const getWorkspaceCollections = (workspacePath) => {
  const config = readWorkspaceConfig(workspacePath);
  return resolveAndFilterWorkspaceCollections(workspacePath, config.collections);
};

const getUnopenableWorkspaceCollections = (workspacePath) => {
  const config = readWorkspaceConfig(workspacePath);

  return resolveWorkspaceCollectionPaths(workspacePath, config.collections)
    .filter((collection) => !collection.remote && !isValidCollectionDirectory(collection.path))
    .map((collection) => ({ name: collection.name, path: collection.path }));
};

const getWorkspaceUid = (workspacePath) => {
  const { defaultWorkspaceManager } = require('../store/default-workspace');
  const defaultWorkspacePath = defaultWorkspaceManager.getDefaultWorkspacePath();
  if (defaultWorkspacePath && path.normalize(workspacePath) === path.normalize(defaultWorkspacePath)) {
    return defaultWorkspaceManager.getDefaultWorkspaceUid();
  }
  return generateUidBasedOnHash(workspacePath);
};

module.exports = {
  makeRelativePath,
  normalizeCollectionEntry,
  validateWorkspacePath,
  normalizeWorkspaceConfig,
  readWorkspaceConfig,
  writeWorkspaceConfig,
  validateWorkspaceConfig,
  addCollectionToWorkspace,
  removeCollectionFromWorkspace,
  reorderWorkspaceCollections,
  getWorkspaceCollections,
  getUnopenableWorkspaceCollections,
  resolveAndFilterWorkspaceCollections,
  generateYamlContent,
  getWorkspaceUid,
  writeWorkspaceFileAtomic,
  isValidCollectionEntry
};
