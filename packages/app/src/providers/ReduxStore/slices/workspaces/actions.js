import path from 'utils/common/path';
import {
  createWorkspace,
  setActiveWorkspace,
  updateWorkspace,
  removeCollectionFromWorkspace,
  updateWorkspaceLoadingState,
  setWorkspaceScratchCollection
} from '../workspaces';
import { openMultipleCollections, openScratchCollectionEvent, mountCollection, hydrateCollectionWithUiStateSnapshot } from '../collections/actions';
import { removeCollection, addTransientDirectory, updateCollectionMountStatus, expandCollection, sortCollections } from '../collections';
import { clearCollectionState } from '../openapi-sync';
import { updateGlobalEnvironments } from '../global-environments';
import { addTab, restoreTabs } from '../tabs';
import {
  setSnapshotReady,
  startSnapshotHydrationSession,
  markSnapshotCollectionHydrated,
  clearSnapshotHydrationSession
} from '../app';
import { normalizePath } from 'utils/common/path';
import { hydrateTabs, getActiveTabFromSnapshot, hydrateSnapshotLookups, getCollectionSnapshotFromLookups, WORKSPACE_TAB_UID_SUFFIX_BY_TYPE } from 'utils/snapshot';
import toast from 'react-hot-toast';

const { ipcRenderer } = window;
let snapshotHydrationTimer = null;
let startupWorkspaceRestorePending = true;
const SNAPSHOT_HYDRATION_LONG_STOP_GUARD_MS = 5 * 60 * 1000;

const COLLECTION_SORT_ORDER_BY_WORKSPACE_SORTING = {
  default: 'default',
  alphabetical: 'alphabetical',
  reverseAlphabetical: 'reverseAlphabetical'
};

const normalizeCollectionSortOrder = (sorting) => {
  return COLLECTION_SORT_ORDER_BY_WORKSPACE_SORTING[sorting] || 'default';
};

const clearSnapshotHydrationTimeout = () => {
  if (snapshotHydrationTimer) {
    clearTimeout(snapshotHydrationTimer);
    snapshotHydrationTimer = null;
  }
};

export const connectCollectionToGit = ({ workspaceUid, collectionPath, remoteUrl }) => {
  return async (dispatch, getState) => {
    try {
      const workspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      await ipcRenderer.invoke(
        'renderer:connect-collection-to-git',
        workspace.pathname,
        collectionPath,
        remoteUrl
      );

      return true;
    } catch (error) {
      toast.error(error.message || 'Failed to connect Git remote');
      throw error;
    }
  };
};

export const disconnectCollectionFromGit = ({ workspaceUid, collectionPath }) => {
  return async (dispatch, getState) => {
    try {
      const workspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      await ipcRenderer.invoke(
        'renderer:disconnect-collection-from-git',
        workspace.pathname,
        collectionPath
      );

      return true;
    } catch (error) {
      toast.error(error.message || 'Failed to remove Git remote');
      throw error;
    }
  };
};

export const removeCollectionFromWorkspaceAction = (workspaceUid, collectionPath, options = {}) => {
  return async (dispatch, getState) => {
    try {
      const { deleteFiles = false } = options;
      const workspacesState = getState().workspaces;
      const collectionsState = getState().collections;
      const workspace = workspacesState.workspaces.find((w) => w.uid === workspaceUid);

      if (!workspace) {
        throw new Error('Workspace not found');
      }

      const normalizedCollectionPath = normalizePath(collectionPath);

      const collection = collectionsState.collections.find(
        (c) => normalizePath(c.pathname) === normalizedCollectionPath
      );

      await ipcRenderer.invoke('renderer:remove-collection-from-workspace',
        workspaceUid,
        workspace.pathname,
        collectionPath,
        { deleteFiles });

      if (collection) {
        const workspaceCollection = workspace.collections?.find(
          (wc) => normalizePath(wc.path) === normalizedCollectionPath
        );

        if (workspaceCollection) {
          dispatch(removeCollection({ collectionUid: collection.uid }));
          dispatch(clearCollectionState({ collectionUid: collection.uid }));
        }
      }

      dispatch(removeCollectionFromWorkspace({
        workspaceUid,
        collectionLocation: collectionPath
      }));

      return true;
    } catch (error) {
      throw error;
    }
  };
};

const loadWorkspaceCollectionsForSwitch = async (dispatch, workspace) => {
  const openCollectionsFunction = (collectionPaths, workspacePath) => {
    return dispatch(openMultipleCollections(collectionPaths, { workspacePath, dontSendDisplayErrors: true }));
  };

  let updatedWorkspace = null;
  let openedCollectionPaths = [];
  const unopenedCollectionPaths = new Set();

  try {
    await dispatch(loadWorkspaceCollections(workspace.uid, true));
    updatedWorkspace = await dispatch((_, getState) => getState().workspaces.workspaces.find((w) => w.uid === workspace.uid));

    if (updatedWorkspace?.collections?.length > 0) {
      const alreadyOpenCollections = await dispatch((_, getState) =>
        getState().collections.collections.map((c) => normalizePath(c.pathname))
      );

      const collectionPaths = updatedWorkspace.collections
        .filter((wc) => !wc.notFoundLocally)
        .map((wc) => wc.path)
        .filter((p) => p && !alreadyOpenCollections.includes(normalizePath(p)));

      const uniqueCollectionPaths = [...new Map(
        collectionPaths.map((collectionPath) => [normalizePath(collectionPath), collectionPath])
      ).values()];

      if (uniqueCollectionPaths.length > 0) {
        const openResult = await openCollectionsFunction(uniqueCollectionPaths, updatedWorkspace.pathname);
        openedCollectionPaths = Array.isArray(openResult?.opened)
          ? openResult.opened
          : uniqueCollectionPaths;

        if (Array.isArray(openResult?.failed) && openResult.failed.length > 0) {
          console.warn('Some workspace collections failed to open during switch:', openResult.failed);
          openResult.failed.forEach((failure) => unopenedCollectionPaths.add(normalizePath(failure.path)));
        }

        if (Array.isArray(openResult?.invalid) && openResult.invalid.length > 0) {
          console.warn('Some workspace collection paths were invalid during switch:', openResult.invalid);
          openResult.invalid.forEach((invalidPath) => unopenedCollectionPaths.add(normalizePath(invalidPath)));
        }
      }
    }

    const unopenableCollections = await dispatch(loadUnopenableWorkspaceCollections(workspace.uid));

    unopenableCollections
      .filter((collection) => collection?.path)
      .forEach((collection) => unopenedCollectionPaths.add(normalizePath(collection.path)));

    if (unopenedCollectionPaths.size > 0) {
      const unopenedCount = unopenedCollectionPaths.size;
      toast.error(`Failed to open ${unopenedCount} application${unopenedCount === 1 ? '' : 's'}`);
    }

    return {
      updatedWorkspace,
      openedCollectionPaths
    };
  } catch (error) {
    console.error('Failed to load workspace collections:', error);

    return {
      updatedWorkspace,
      openedCollectionPaths
    };
  }
};

const maybeCompleteSnapshotHydrationSession = (dispatch, getState) => {
  const state = getState();
  const snapshotHydration = state.app.snapshotHydration;

  if (!snapshotHydration?.workspaceUid) {
    return false;
  }

  if (state.workspaces.activeWorkspaceUid !== snapshotHydration.workspaceUid) {
    clearSnapshotHydrationTimeout();
    dispatch(clearSnapshotHydrationSession());
    return false;
  }

  if (snapshotHydration.pendingCollectionPathnames.length > 0) {
    return false;
  }

  clearSnapshotHydrationTimeout();
  dispatch(setSnapshotReady(true));
  dispatch(clearSnapshotHydrationSession());
  return true;
};

const scheduleSnapshotHydrationTimeout = (dispatch, getState, workspaceUid) => {
  clearSnapshotHydrationTimeout();

  snapshotHydrationTimer = setTimeout(() => {
    const state = getState();
    const session = state.app.snapshotHydration;

    if (!session?.workspaceUid || session.workspaceUid !== workspaceUid) {
      return;
    }

    const pendingCount = session.pendingCollectionPathnames.length;
    if (pendingCount > 0) {
      console.warn(
        `Snapshot hydration timeout for workspace ${workspaceUid}. `
        + `Proceeding with ${pendingCount} collection(s) still pending.`
      );
    }

    dispatch(setSnapshotReady(true));
    dispatch(clearSnapshotHydrationSession());
    clearSnapshotHydrationTimeout();
  }, SNAPSHOT_HYDRATION_LONG_STOP_GUARD_MS);
};

export const hydrateSnapshotForOpenedCollection = (collectionPathname) => {
  return async (dispatch, getState) => {
    if (!collectionPathname) {
      return;
    }

    const state = getState();
    const snapshotHydration = state.app.snapshotHydration;

    if (!snapshotHydration?.workspaceUid) {
      return;
    }

    if (state.workspaces.activeWorkspaceUid !== snapshotHydration.workspaceUid) {
      clearSnapshotHydrationTimeout();
      dispatch(clearSnapshotHydrationSession());
      return;
    }

    const normalizedCollectionPath = normalizePath(collectionPathname);
    const isPendingHydration = snapshotHydration.pendingCollectionPathnames.some(
      (pathname) => normalizePath(pathname) === normalizedCollectionPath
    );

    if (!isPendingHydration) {
      return;
    }

    const collection = state.collections.collections.find(
      (c) => c.pathname && normalizePath(c.pathname) === normalizedCollectionPath
    );

    if (!collection) {
      return;
    }

    const activeWorkspace = state.workspaces.workspaces.find((w) => w.uid === snapshotHydration.workspaceUid);
    const activeWorkspacePathname = activeWorkspace?.pathname || null;

    await hydrateTabs([collection], dispatch, restoreTabs, null, activeWorkspacePathname);

    if (
      snapshotHydration.activeCollectionPathname
      && normalizePath(snapshotHydration.activeCollectionPathname) === normalizedCollectionPath
    ) {
      dispatch(expandCollection(collection.uid));

      const needsMount = collection.mountStatus !== 'mounted' && collection.mountStatus !== 'mounting';
      if (needsMount) {
        await dispatch(mountCollection({
          collectionUid: collection.uid,
          collectionPathname: collection.pathname,
          brunoConfig: collection.brunoConfig,
          skipTabRestore: true,
          workspacePathname: activeWorkspacePathname
        })).catch((err) => console.error('Failed to mount active collection:', err));
      }

      const activeTab = await getActiveTabFromSnapshot(
        collection.pathname,
        collection,
        null,
        activeWorkspacePathname
      );
      if (activeTab) {
        dispatch(addTab(activeTab));
      }
    }

    dispatch(markSnapshotCollectionHydrated({ pathname: collection.pathname }));
    maybeCompleteSnapshotHydrationSession(dispatch, getState);
  };
};

export const activateWorkspace = (workspaceUid) => {
  return async (dispatch, getState) => {
    clearSnapshotHydrationTimeout();
    dispatch(setSnapshotReady(false));
    dispatch(clearSnapshotHydrationSession());
    try {
      dispatch(setActiveWorkspace(workspaceUid));

      const workspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);
      if (!workspace) {
        return;
      }

      const fullSnapshot = await ipcRenderer.invoke('renderer:snapshot:get').catch(() => null);
      const snapshotLookups = hydrateSnapshotLookups(fullSnapshot || {});
      const workspaceSnapshot = workspace.pathname
        ? snapshotLookups.workspacesByPath[normalizePath(workspace.pathname)] || null
        : null;
      const snapshotCollectionSortOrder = normalizeCollectionSortOrder(workspaceSnapshot?.sorting);
      dispatch(sortCollections({ order: snapshotCollectionSortOrder }));

      // Load global environments
      const envResult = await ipcRenderer.invoke('renderer:get-global-environments', {
        workspaceUid,
        workspacePath: workspace.pathname
      }).catch(() => null);

      dispatch(updateGlobalEnvironments({
        globalEnvironments: envResult?.globalEnvironments || [],
        activeGlobalEnvironmentUid: envResult?.activeGlobalEnvironmentUid || null
      }));

      // Mount scratch collection and load workspace collections
      const scratchCollection = await dispatch(mountScratchCollection(workspaceUid));
      const { updatedWorkspace, openedCollectionPaths } = await loadWorkspaceCollectionsForSwitch(dispatch, workspace);

      const latestWorkspace = updatedWorkspace || getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);
      const workspaceCollectionPaths = [...new Map(
        (latestWorkspace?.collections || [])
          .map((workspaceCollection) => workspaceCollection.path)
          .filter(Boolean)
          .map((collectionPath) => [normalizePath(collectionPath), collectionPath])
      ).values()];
      const workspaceCollectionPathSet = new Set(
        workspaceCollectionPaths.map((collectionPath) => normalizePath(collectionPath))
      );

      // Hydrate tabs for workspace collections currently present in Redux
      const collections = getState().collections.collections.filter(
        (c) => c.pathname
          && c.uid !== scratchCollection?.uid
          && workspaceCollectionPathSet.has(normalizePath(c.pathname))
      );
      await hydrateTabs(collections, dispatch, restoreTabs, snapshotLookups, workspace.pathname || null);

      // Restore each collection's workspace-scoped selected environment, so the same
      // collection open under two workspaces restores its own environment per workspace.
      await Promise.all(collections.map((collection) => {
        const collectionSnapshotState = getCollectionSnapshotFromLookups(
          collection.pathname,
          snapshotLookups,
          workspace.pathname || null
        );
        return dispatch(hydrateCollectionWithUiStateSnapshot(
          collectionSnapshotState
            ? { pathname: collection.pathname, ...collectionSnapshotState, hasSnapshotEntry: true }
            : { pathname: collection.pathname, hasSnapshotEntry: false }
        ));
      }));

      let requestedWorkspaceTabType = null;

      // Add workspace tabs
      if (scratchCollection?.uid) {
        dispatch(addTab({ uid: `${scratchCollection.uid}-overview`, collectionUid: scratchCollection.uid, type: 'workspaceOverview' }));
        dispatch(addTab({ uid: `${scratchCollection.uid}-environments`, collectionUid: scratchCollection.uid, type: 'workspaceEnvironments' }));

        requestedWorkspaceTabType = workspaceSnapshot?.activeWorkspaceTabType;
        const requestedWorkspaceTabSuffix = WORKSPACE_TAB_UID_SUFFIX_BY_TYPE[requestedWorkspaceTabType];
        if (requestedWorkspaceTabSuffix) {
          const requestedWorkspaceTabUid = `${scratchCollection.uid}-${requestedWorkspaceTabSuffix}`;
          dispatch(addTab({
            uid: requestedWorkspaceTabUid,
            collectionUid: scratchCollection.uid,
            type: requestedWorkspaceTabType
          }));
        }
      }

      // Restore active collection from snapshot using lastActiveCollectionPathname
      const lastActiveCollectionPathname = workspaceSnapshot?.lastActiveCollectionPathname || null;
      const activeCollection = lastActiveCollectionPathname
        ? getState().collections.collections.find((c) => normalizePath(c.pathname) === normalizePath(lastActiveCollectionPathname))
        : null;

      if (activeCollection) {
        dispatch(expandCollection(activeCollection.uid));

        const needsMount = activeCollection.mountStatus !== 'mounted' && activeCollection.mountStatus !== 'mounting';
        if (needsMount) {
          await dispatch(mountCollection({
            collectionUid: activeCollection.uid,
            collectionPathname: activeCollection.pathname,
            brunoConfig: activeCollection.brunoConfig,
            skipTabRestore: true,
            workspacePathname: workspace.pathname || null
          })).catch((err) => console.error('Failed to mount active collection:', err));
        }

        // Focus the active tab from the collection's tab snapshot
        const activeTab = await getActiveTabFromSnapshot(
          activeCollection.pathname,
          activeCollection,
          snapshotLookups,
          workspace.pathname || null
        );

        if (activeTab) {
          dispatch(addTab(activeTab));
        } else if (scratchCollection?.uid && !requestedWorkspaceTabType) {
          dispatch(addTab({ uid: `${scratchCollection.uid}-overview`, collectionUid: scratchCollection.uid, type: 'workspaceOverview' }));
        }
      } else if (scratchCollection?.uid && !requestedWorkspaceTabType) {
        // No active collection, focus the workspace overview tab
        dispatch(addTab({ uid: `${scratchCollection.uid}-overview`, collectionUid: scratchCollection.uid, type: 'workspaceOverview' }));
      }

      const openWorkspaceCollectionPaths = new Set(
        getState().collections.collections
          .filter((c) => c.pathname && workspaceCollectionPathSet.has(normalizePath(c.pathname)))
          .map((c) => normalizePath(c.pathname))
      );

      const expectedHydrationCollectionPathnames = Array.isArray(openedCollectionPaths) && openedCollectionPaths.length > 0
        ? openedCollectionPaths
        : [];

      const pendingCollectionPathnames = expectedHydrationCollectionPathnames
        .filter((collectionPath) => !openWorkspaceCollectionPaths.has(normalizePath(collectionPath)));

      dispatch(startSnapshotHydrationSession({
        workspaceUid,
        pendingCollectionPathnames,
        activeCollectionPathname: lastActiveCollectionPathname || null
      }));

      const completed = maybeCompleteSnapshotHydrationSession(dispatch, getState);
      if (!completed && pendingCollectionPathnames.length > 0) {
        scheduleSnapshotHydrationTimeout(dispatch, getState, workspaceUid);
      }
    } catch (error) {
      console.error('Failed to activate workspace:', error);
    } finally {
      const state = getState();
      const hasHydrationSession = Boolean(state.app.snapshotHydration?.workspaceUid);
      if (!state.app.snapshotReady && !hasHydrationSession) {
        dispatch(setSnapshotReady(true));
      }
    }
  };
};

export const loadWorkspaceCollections = (workspaceUid, force = false) => {
  return async (dispatch, getState) => {
    try {
      const workspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);
      if (!workspace) {
        throw new Error('Workspace not found');
      }

      const hasProcessedCollections = workspace.collections
        && workspace.collections.length > 0
        && workspace.collections.some((c) => c.path && path.isAbsolute(c.path));

      if (!force && hasProcessedCollections) {
        return workspace.collections;
      }

      dispatch(updateWorkspaceLoadingState({ workspaceUid, loadingState: 'loading' }));

      let collections = [];

      if (workspace.pathname) {
        const rawCollections = await ipcRenderer.invoke('renderer:load-workspace-collections', workspace.pathname);

        collections = rawCollections.map((collection) => {
          return {
            ...collection
          };
        });
      }

      dispatch(updateWorkspace({
        uid: workspaceUid,
        collections
      }));

      dispatch(updateWorkspaceLoadingState({ workspaceUid, loadingState: 'loaded' }));

      return collections;
    } catch (error) {
      dispatch(updateWorkspaceLoadingState({ workspaceUid, loadingState: 'error' }));
      throw error;
    }
  };
};

export const loadUnopenableWorkspaceCollections = (workspaceUid) => {
  return async (dispatch, getState) => {
    const workspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);
    if (!workspace?.pathname) {
      return [];
    }

    const unopenableCollections = await ipcRenderer
      .invoke('renderer:load-unopenable-workspace-collections', workspace.pathname)
      .catch((error) => {
        console.warn('Failed to identify which workspace collections cannot be opened', error);
        return [];
      });

    dispatch(updateWorkspace({ uid: workspaceUid, unopenableCollections }));

    return unopenableCollections;
  };
};

export const restoreActiveWorkspaceFromSnapshot = () => {
  return async (dispatch, getState) => {
    startupWorkspaceRestorePending = false;

    const { workspaces } = getState().workspaces;
    const workspace = workspaces.find((w) => w.type === 'default') || workspaces[0];
    if (workspace) {
      await dispatch(activateWorkspace(workspace.uid));
    }
  };
};

export const workspaceOpenedEvent = (workspacePath, workspaceUid, workspaceConfig) => {
  return async (dispatch, getState) => {
    const deferSwitchToStartupRestore = startupWorkspaceRestorePending;
    dispatch(createWorkspace({
      uid: workspaceUid,
      pathname: workspacePath,
      ...workspaceConfig
    }));

    try {
      await dispatch(loadWorkspaceCollections(workspaceUid));
    } catch (error) {
    }

    if (deferSwitchToStartupRestore) {
      return;
    }

    // Only one workspace is ever loaded, so activate it unless another is already active.
    const activeWorkspaceUid = getState().workspaces.activeWorkspaceUid;
    if (!activeWorkspaceUid || activeWorkspaceUid === workspaceUid || workspaceConfig.type === 'default') {
      await dispatch(activateWorkspace(workspaceUid));
    }
  };
};

export const workspaceConfigUpdatedEvent = (workspacePath, workspaceUid, workspaceConfig) => {
  return async (dispatch, getState) => {
    if (!workspaceConfig) {
      return;
    }

    const { collections, ...configWithoutCollections } = workspaceConfig;

    dispatch(updateWorkspace({
      uid: workspaceUid,
      ...configWithoutCollections
    }));

    const activeWorkspaceUid = getState().workspaces.activeWorkspaceUid;
    if (activeWorkspaceUid === workspaceUid) {
      try {
        await dispatch(loadWorkspaceCollections(workspaceUid, true));
        await dispatch(loadUnopenableWorkspaceCollections(workspaceUid));

        const workspace = getState().workspaces.workspaces.find((w) => w.uid === workspaceUid);
        const openCollections = getState().collections.collections.map((c) => normalizePath(c.pathname));

        if (workspace?.collections?.length > 0) {
          const newCollectionPaths = workspace.collections
            .filter((workspaceCollection) => !workspaceCollection.notFoundLocally)
            .map((workspaceCollection) => workspaceCollection.path)
            .filter((collectionPath) => collectionPath && !openCollections.includes(normalizePath(collectionPath)));

          // Deduplicate paths to prevent "collection already opened" toast
          const uniqueNewCollectionPaths = [...new Map(
            newCollectionPaths.map((p) => [normalizePath(p), p])
          ).values()];

          if (uniqueNewCollectionPaths.length > 0) {
            try {
              await dispatch(openMultipleCollections(uniqueNewCollectionPaths, { workspacePath: workspace.pathname }));
            } catch (error) {
            }
          }
        }
      } catch (error) {
      }
    }
  };
};

export const saveWorkspaceDotEnvVariables = (workspaceUid, variables, filename = '.env') => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const workspace = state.workspaces.workspaces.find((w) => w.uid === workspaceUid);

    if (!workspace) {
      return reject(new Error('Workspace not found'));
    }

    if (!workspace.pathname) {
      return reject(new Error('Workspace path not found'));
    }

    ipcRenderer
      .invoke('renderer:save-workspace-dotenv-variables', { workspacePath: workspace.pathname, variables, filename })
      .then(resolve)
      .catch(reject);
  });
};

export const saveWorkspaceDotEnvRaw = (workspaceUid, content, filename = '.env') => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const workspace = state.workspaces.workspaces.find((w) => w.uid === workspaceUid);

    if (!workspace) {
      return reject(new Error('Workspace not found'));
    }

    if (!workspace.pathname) {
      return reject(new Error('Workspace path not found'));
    }

    ipcRenderer
      .invoke('renderer:save-workspace-dotenv-raw', { workspacePath: workspace.pathname, content, filename })
      .then(resolve)
      .catch(reject);
  });
};

export const createWorkspaceDotEnvFile = (workspaceUid, filename = '.env') => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const workspace = state.workspaces.workspaces.find((w) => w.uid === workspaceUid);

    if (!workspace) {
      return reject(new Error('Workspace not found'));
    }

    if (!workspace.pathname) {
      return reject(new Error('Workspace path not found'));
    }

    ipcRenderer
      .invoke('renderer:create-workspace-dotenv-file', { workspacePath: workspace.pathname, filename })
      .then(resolve)
      .catch(reject);
  });
};

export const deleteWorkspaceDotEnvFile = (workspaceUid, filename = '.env') => (dispatch, getState) => {
  return new Promise((resolve, reject) => {
    const state = getState();
    const workspace = state.workspaces.workspaces.find((w) => w.uid === workspaceUid);

    if (!workspace) {
      return reject(new Error('Workspace not found'));
    }

    if (!workspace.pathname) {
      return reject(new Error('Workspace path not found'));
    }

    ipcRenderer
      .invoke('renderer:delete-workspace-dotenv-file', { workspacePath: workspace.pathname, filename })
      .then(resolve)
      .catch(reject);
  });
};

// Scratch Collection Actions

/**
 * Mount scratch collection for a workspace
 */
export const mountScratchCollection = (workspaceUid) => {
  return async (dispatch, getState) => {
    const state = getState();
    const workspace = state.workspaces.workspaces.find((w) => w.uid === workspaceUid);

    if (!workspace) {
      return null;
    }

    if (workspace.scratchCollectionUid) {
      const existingCollection = state.collections.collections.find(
        (c) => c.uid === workspace.scratchCollectionUid
      );
      if (existingCollection) {
        return existingCollection;
      }
    }

    try {
      const tempDirectoryPath = await ipcRenderer.invoke('renderer:mount-workspace-scratch', {
        workspaceUid,
        workspacePath: workspace.pathname || 'default'
      });

      const { generateUidBasedOnHash } = await import('utils/common');
      const scratchCollectionUid = generateUidBasedOnHash(tempDirectoryPath);

      const brunoConfig = {
        opencollection: '1.0.0',
        name: 'Scratch',
        type: 'collection',
        ignore: ['node_modules', '.git']
      };

      await ipcRenderer.invoke('renderer:add-collection-watcher', {
        collectionPath: tempDirectoryPath,
        collectionUid: scratchCollectionUid,
        brunoConfig
      });

      // Map scratch collection to workspace so getProcessEnvVars can resolve workspace .env values
      if (workspace.pathname) {
        await ipcRenderer.invoke('renderer:set-collection-workspace', scratchCollectionUid, workspace.pathname);
      }

      await dispatch(openScratchCollectionEvent(scratchCollectionUid, tempDirectoryPath, brunoConfig));

      dispatch(setWorkspaceScratchCollection({
        workspaceUid,
        scratchCollectionUid,
        scratchTempDirectory: tempDirectoryPath
      }));

      dispatch(addTransientDirectory({
        collectionUid: scratchCollectionUid,
        pathname: tempDirectoryPath
      }));

      dispatch(updateCollectionMountStatus({ collectionUid: scratchCollectionUid, mountStatus: 'mounted' }));

      return { uid: scratchCollectionUid, pathname: tempDirectoryPath };
    } catch (error) {
      console.error('Error mounting scratch collection:', error);
      if (workspace.scratchCollectionUid) {
        dispatch(updateCollectionMountStatus({ collectionUid: workspace.scratchCollectionUid, mountStatus: 'unmounted' }));
      }
      return null;
    }
  };
};
