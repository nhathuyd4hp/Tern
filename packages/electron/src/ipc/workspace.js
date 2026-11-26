const fs = require('fs');
const path = require('path');
const fsExtra = require('fs-extra');
const { ipcMain } = require('electron');
const isDev = require('electron-is-dev');
const { createDirectory } = require('../utils/filesystem');
const { defaultWorkspaceManager } = require('../store/default-workspace');

const {
  readWorkspaceConfig,
  addCollectionToWorkspace,
  removeCollectionFromWorkspace,
  reorderWorkspaceCollections,
  getWorkspaceCollections,
  getUnopenableWorkspaceCollections,
  resolveAndFilterWorkspaceCollections,
  normalizeCollectionEntry,
  validateWorkspacePath,
  getWorkspaceUid
} = require('../utils/workspace-config');

const DEFAULT_WORKSPACE_NAME = require('node:os').hostname();

const prepareWorkspaceConfigForClient = (workspaceConfig, workspacePath, isDefault) => {
  const config = {
    ...workspaceConfig,
    collections: resolveAndFilterWorkspaceCollections(workspacePath, workspaceConfig.collections)
  };

  if (isDefault) {
    return {
      ...config,
      name: DEFAULT_WORKSPACE_NAME,
      type: 'default'
    };
  }
  return config;
};

const registerWorkspaceIpc = (mainWindow, workspaceWatcher) => {
  ipcMain.handle('renderer:load-workspace-collections', async (event, workspacePath) => {
    try {
      if (!workspacePath) {
        throw new Error('Workspace path is undefined');
      }

      validateWorkspacePath(workspacePath);
      return getWorkspaceCollections(workspacePath);
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle('renderer:load-unopenable-workspace-collections', async (event, workspacePath) => {
    try {
      if (!workspacePath) {
        throw new Error('Workspace path is undefined');
      }

      validateWorkspacePath(workspacePath);
      return getUnopenableWorkspaceCollections(workspacePath);
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle('renderer:reorder-workspace-collections', async (event, workspacePath, collectionPaths) => {
    try {
      if (!workspacePath) {
        throw new Error('Workspace path is undefined');
      }
      validateWorkspacePath(workspacePath);
      await reorderWorkspaceCollections(workspacePath, collectionPaths);
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle('renderer:add-collection-to-workspace', async (event, workspacePath, collection) => {
    try {
      const normalizedCollection = normalizeCollectionEntry(workspacePath, collection);
      const updatedCollections = await addCollectionToWorkspace(workspacePath, normalizedCollection);

      const workspaceConfig = readWorkspaceConfig(workspacePath);
      const workspaceUid = getWorkspaceUid(workspacePath);
      const isDefault = workspaceUid === 'default';
      const configForClient = prepareWorkspaceConfigForClient(workspaceConfig, workspacePath, isDefault);
      mainWindow.webContents.send('main:workspace-config-updated', workspacePath, workspaceUid, configForClient);

      return updatedCollections;
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle('renderer:ensure-collections-folder', async (event, workspacePath) => {
    try {
      const collectionsPath = path.join(workspacePath, 'collections');
      if (!fs.existsSync(collectionsPath)) {
        await createDirectory(collectionsPath);
      }
      return collectionsPath;
    } catch (error) {
      throw error;
    }
  });

  ipcMain.handle('renderer:remove-collection-from-workspace', async (event, workspaceUid, workspacePath, collectionPath, options = {}) => {
    try {
      const { deleteFiles = false } = options;
      const result = await removeCollectionFromWorkspace(workspacePath, collectionPath);

      if (result.removedCollection) {
        // Detach and clear every cache keyed by this collection's (deterministic, path-derived)
        // uid — otherwise re-adding the same folder later resurfaces a stale mount/config/uid
        // cache instead of loading it fresh.
        const { generateUidBasedOnHash } = require('../utils/common');
        const collectionUid = generateUidBasedOnHash(collectionPath);
        const collectionWatcher = require('../app/collection-watcher');
        collectionWatcher.removeWatcher(collectionPath, mainWindow, collectionUid);
        require('../store/bruno-config').clearBrunoConfig(collectionUid);
        require('../cache/requestUids').clearRequestUidsForCollection(collectionPath);
      }

      if (deleteFiles && result.removedCollection && fs.existsSync(collectionPath)) {
        await fsExtra.remove(collectionPath);
      }

      const correctWorkspaceUid = getWorkspaceUid(workspacePath);
      const isDefault = correctWorkspaceUid === 'default';
      const configForClient = prepareWorkspaceConfigForClient(result.updatedConfig, workspacePath, isDefault);
      mainWindow.webContents.send('main:workspace-config-updated', workspacePath, correctWorkspaceUid, configForClient);

      return true;
    } catch (error) {
      throw error;
    }
  });

  // Guard to prevent main:renderer-ready from running multiple times (only needed in dev mode due to strict mode)
  let rendererReadyProcessed = false;

  ipcMain.on('main:renderer-ready', async (win) => {
    if (isDev && rendererReadyProcessed) {
      return;
    }
    rendererReadyProcessed = true;

    try {
      const defaultResult = await defaultWorkspaceManager.ensureDefaultWorkspaceExists();
      if (defaultResult) {
        const { workspacePath, workspaceUid } = defaultResult;
        const workspaceConfig = readWorkspaceConfig(workspacePath);
        const configForClient = prepareWorkspaceConfigForClient(workspaceConfig, workspacePath, true);

        win.webContents.send('main:workspace-opened', workspacePath, workspaceUid, configForClient);

        if (workspaceWatcher) {
          workspaceWatcher.addWatcher(win, workspacePath);
        }
      }
    } catch (error) {
      console.error('Error initializing workspaces:', error);
    }

    win.webContents.send('main:workspaces-ready');
    ipcMain.emit('main:workspaces-ready', win);
  });
};

module.exports = registerWorkspaceIpc;
