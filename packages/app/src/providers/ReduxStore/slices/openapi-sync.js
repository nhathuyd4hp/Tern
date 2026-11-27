import { createSlice } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import { findCollectionByUid, getWorkspaceCollections } from 'utils/collections';
import { findFolderItemBySyncPath, getSyncEntry, listSyncEntries, syncKeyOf } from 'utils/openapi-sync-scope';

const initialState = {
  // Map of collectionUid -> { hasUpdates, lastChecked, error }
  // Lightweight indicator state for the toolbar status badge — fed by
  // background polling. Full drift data lives in `drift` (this slice).
  collectionUpdates: {},
  // Whether App level OpenAPI polling is enabled
  pollingEnabled: true,
  // Last poll timestamp
  lastPollTime: null,
  // Map of collectionUid -> { activeTab, expandedSections, expandedRows }
  tabUiState: {},
  // Map of collectionUid -> { title, version, endpointCount }
  storedSpecMeta: {},
  // Map of collectionUid -> full parsed OpenAPI spec object
  storedSpec: {},
  // Map of collectionUid -> { specDrift, collectionDrift, remoteDrift, fetching, lastChecked }
  drift: {}
};

export const openapiSyncSlice = createSlice({
  name: 'openapiSync',
  initialState,
  reducers: {
    setCollectionUpdate: (state, action) => {
      const { collectionUid, hasUpdates, error } = action.payload;
      state.collectionUpdates[collectionUid] = {
        hasUpdates,
        error,
        lastChecked: Date.now()
      };
    },
    clearCollectionUpdate: (state, action) => {
      const { collectionUid } = action.payload;
      delete state.collectionUpdates[collectionUid];
    },
    clearCollectionState: (state, action) => {
      const { collectionUid } = action.payload;
      delete state.collectionUpdates[collectionUid];
      delete state.tabUiState[collectionUid];
      delete state.storedSpecMeta[collectionUid];
      delete state.storedSpec[collectionUid];
      delete state.drift[collectionUid];
    },
    setDrift: (state, action) => {
      const { collectionUid, patch } = action.payload;
      state.drift[collectionUid] = { ...state.drift[collectionUid], ...patch };
    },
    clearDrift: (state, action) => {
      const { collectionUid } = action.payload;
      delete state.drift[collectionUid];
    },
    clearOpenApiSyncTabState: (state, action) => {
      const { collectionUid } = action.payload;
      delete state.drift[collectionUid];
      delete state.storedSpec[collectionUid];
      delete state.tabUiState[collectionUid];
    },
    setStoredSpec: (state, action) => {
      const { collectionUid, spec } = action.payload;
      if (spec === null || spec === undefined) {
        delete state.storedSpec[collectionUid];
      } else {
        state.storedSpec[collectionUid] = spec;
      }
    },
    setStoredSpecMeta: (state, action) => {
      const { collectionUid, title, version, endpointCount } = action.payload;
      state.storedSpecMeta[collectionUid] = { title, version, endpointCount };
    },
    setPollingEnabled: (state, action) => {
      state.pollingEnabled = action.payload;
    },
    setLastPollTime: (state, action) => {
      state.lastPollTime = action.payload;
    },
    // UI state reducers
    setTabUiState: (state, action) => {
      const { collectionUid, ...uiState } = action.payload;
      if (!state.tabUiState[collectionUid]) {
        state.tabUiState[collectionUid] = {};
      }
      Object.assign(state.tabUiState[collectionUid], uiState);
    },
    toggleSectionExpanded: (state, action) => {
      const { collectionUid, sectionKey } = action.payload;
      if (!state.tabUiState[collectionUid]) {
        state.tabUiState[collectionUid] = {};
      }
      if (!state.tabUiState[collectionUid].expandedSections) {
        state.tabUiState[collectionUid].expandedSections = {};
      }
      const current = state.tabUiState[collectionUid].expandedSections[sectionKey];
      state.tabUiState[collectionUid].expandedSections[sectionKey] = !current;
    },
    setSectionExpanded: (state, action) => {
      const { collectionUid, sectionKey, expanded } = action.payload;
      if (!state.tabUiState[collectionUid]) {
        state.tabUiState[collectionUid] = {};
      }
      if (!state.tabUiState[collectionUid].expandedSections) {
        state.tabUiState[collectionUid].expandedSections = {};
      }
      state.tabUiState[collectionUid].expandedSections[sectionKey] = expanded;
    },
    toggleRowExpanded: (state, action) => {
      const { collectionUid, rowKey } = action.payload;
      if (!state.tabUiState[collectionUid]) {
        state.tabUiState[collectionUid] = {};
      }
      if (!state.tabUiState[collectionUid].expandedRows) {
        state.tabUiState[collectionUid].expandedRows = {};
      }
      const current = state.tabUiState[collectionUid].expandedRows[rowKey];
      state.tabUiState[collectionUid].expandedRows[rowKey] = !current;
    },
    setReviewDecision: (state, action) => {
      const { collectionUid, endpointId, decision } = action.payload;
      if (!state.tabUiState[collectionUid]) {
        state.tabUiState[collectionUid] = {};
      }
      if (!state.tabUiState[collectionUid].reviewDecisions) {
        state.tabUiState[collectionUid].reviewDecisions = {};
      }
      state.tabUiState[collectionUid].reviewDecisions[endpointId] = decision;
    },
    setReviewDecisions: (state, action) => {
      const { collectionUid, decisions } = action.payload;
      if (!state.tabUiState[collectionUid]) {
        state.tabUiState[collectionUid] = {};
      }
      // Merge into existing decisions instead of replacing, so decisions
      // for other change types (e.g., specChanges) are preserved
      state.tabUiState[collectionUid].reviewDecisions = {
        ...state.tabUiState[collectionUid].reviewDecisions,
        ...decisions
      };
    }
  }
});

export const {
  setCollectionUpdate,
  clearCollectionUpdate,
  clearCollectionState,
  setPollingEnabled,
  setTabUiState,
  toggleSectionExpanded,
  setSectionExpanded,
  toggleRowExpanded,
  setLastPollTime,
  setReviewDecision,
  setReviewDecisions,
  setStoredSpec,
  setStoredSpecMeta,
  setDrift,
  clearDrift,
  clearOpenApiSyncTabState
} = openapiSyncSlice.actions;

const autoApplyingKeys = new Set();

// Fetches the spec again and writes its changes without review: new and changed endpoints are written and endpoints
// removed from the spec are deleted. Requests the user added locally are never touched, and locally edited values
// are preserved. Throws when the spec cannot be read.
const applySpecChanges = (collection, folder, syncConfig) => async (dispatch) => {
  const collectionUid = syncKeyOf(collection.uid, folder);
  const { ipcRenderer } = window;
  const specDrift = await ipcRenderer.invoke('renderer:compare-openapi-specs', {
    collectionUid: collection.uid,
    collectionPath: collection.pathname,
    folder,
    sourceUrl: syncConfig.sourceUrl,
    environmentContext: {
      activeEnvironmentUid: collection.activeEnvironmentUid,
      environments: collection.environments,
      runtimeVariables: collection.runtimeVariables,
      globalEnvironmentVariables: collection.globalEnvironmentVariables
    }
  });
  if (specDrift.error || specDrift.isValid === false) {
    throw new Error(specDrift.error || 'The spec is not a valid OpenAPI document');
  }

  await ipcRenderer.invoke('renderer:apply-openapi-sync', {
    collectionUid: collection.uid,
    collectionPath: collection.pathname,
    folder,
    addNewRequests: true,
    removeDeletedRequests: true,
    diff: specDrift,
    localOnlyToRemove: [],
    driftedToReset: [],
    mode: 'sync',
    endpointDecisions: {},
    preserveValues: true
  });

  dispatch(clearCollectionUpdate({ collectionUid }));
  dispatch(clearDrift({ collectionUid }));
};

// Auto Reload: applies a changed spec as soon as a check finds one.
export const autoApplySpecChanges = (collection, folder, syncConfig) => async (dispatch) => {
  const collectionUid = syncKeyOf(collection.uid, folder);
  if (autoApplyingKeys.has(collectionUid)) return;
  autoApplyingKeys.add(collectionUid);

  try {
    await dispatch(applySpecChanges(collection, folder, syncConfig));
    toast.success('OpenAPI spec changes applied automatically');
  } catch (error) {
    console.error('[OpenAPI Sync] Auto reload failed:', error);
    dispatch(setCollectionUpdate({ collectionUid, hasUpdates: true, error: error.message }));
  } finally {
    autoApplyingKeys.delete(collectionUid);
  }
};

// Lightweight thunk for polling — only checks hash, no deep comparison. `folder` picks the sync entry
// of one collection of the application; without it the application-wide entry is checked.
export const checkCollectionForUpdates = (collection, folder = '') => async (dispatch) => {
  const syncConfig = getSyncEntry(collection, folder);
  if (!syncConfig?.sourceUrl) {
    return null;
  }

  const collectionUid = syncKeyOf(collection.uid, folder);
  try {
    const { ipcRenderer } = window;
    const result = await ipcRenderer.invoke('renderer:check-openapi-updates', {
      collectionUid: collection.uid,
      collectionPath: collection.pathname,
      sourceUrl: syncConfig.sourceUrl,
      storedSpecHash: syncConfig.specHash || null,
      environmentContext: {
        activeEnvironmentUid: collection.activeEnvironmentUid,
        environments: collection.environments,
        runtimeVariables: collection.runtimeVariables,
        globalEnvironmentVariables: collection.globalEnvironmentVariables
      }
    });

    dispatch(setCollectionUpdate({
      collectionUid,
      hasUpdates: result.hasUpdates || false,
      error: result.error || null
    }));

    if (result.hasUpdates && syncConfig.autoApply === true && syncConfig.autoCheck !== false) {
      await dispatch(autoApplySpecChanges(collection, folder, syncConfig));
    }

    return result;
  } catch (error) {
    console.error('[OpenAPI Sync] Error checking for updates:', error);
    dispatch(setCollectionUpdate({
      collectionUid,
      hasUpdates: false,
      error: error.message
    }));
    return null;
  }
};

// Thunk to check active workspace collections for updates (respects per-entry autoCheck and autoCheckInterval)
export const checkActiveWorkspaceCollectionsForUpdates = () => async (dispatch, getState) => {
  const state = getState();
  const collections = state.collections?.collections || [];
  const { workspaces, activeWorkspaceUid } = state.workspaces;
  const activeWorkspace = workspaces.find((w) => w.uid === activeWorkspaceUid);
  const now = Date.now();

  for (const collection of getWorkspaceCollections({ collections, workspaces, activeWorkspace })) {
    for (const { folder, entry } of listSyncEntries(collection)) {
      if (entry.autoCheck === false) continue;

      const intervalMs = (entry.autoCheckInterval || 5) * 60 * 1000;
      const lastChecked = state.openapiSync?.collectionUpdates?.[syncKeyOf(collection.uid, folder)]?.lastChecked || 0;

      // Only check if enough time has elapsed since last check for this entry
      if (now - lastChecked >= intervalMs) {
        await dispatch(checkCollectionForUpdates(collection, folder));
      }
    }
  }

  dispatch(setLastPollTime(Date.now()));
};

const reloadingApplications = new Set();

// Reload application: re-syncs every collection of the application that is connected to an OpenAPI spec, one after
// the other, and carries on when one fails. Resolves with { total, reloaded, failed: [collection names] }, or null
// when a reload of this application is already running.
export const reloadApplication = (application) => async (dispatch, getState) => {
  if (reloadingApplications.has(application.uid)) return null;
  reloadingApplications.add(application.uid);

  try {
    const current = findCollectionByUid(getState().collections?.collections || [], application.uid) || application;
    const entries = listSyncEntries(current);
    if (!entries.length) {
      toast('No collection is synced with an OpenAPI spec');
      return { total: 0, reloaded: 0, failed: [] };
    }

    const toastId = toast.loading(`Reloading ${current.name}…`);
    const failed = [];
    for (const { folder, entry } of entries) {
      const name = folder ? findFolderItemBySyncPath(current, folder)?.name || folder : current.name;
      const key = syncKeyOf(current.uid, folder);
      try {
        if (autoApplyingKeys.has(key)) throw new Error('Already syncing');
        autoApplyingKeys.add(key);
        try {
          await dispatch(applySpecChanges(current, folder, entry));
        } finally {
          autoApplyingKeys.delete(key);
        }
      } catch (error) {
        console.error('[OpenAPI Sync] Reload failed:', error);
        dispatch(setCollectionUpdate({ collectionUid: key, hasUpdates: true, error: error.message }));
        failed.push(name);
      }
    }

    const reloaded = entries.length - failed.length;
    const summary = `Reloaded ${reloaded} ${reloaded === 1 ? 'collection' : 'collections'}`;
    if (failed.length) toast.error(`${summary}, ${failed.length} failed: ${failed.join(', ')}`, { id: toastId });
    else toast.success(summary, { id: toastId });
    return { total: entries.length, reloaded, failed };
  } finally {
    reloadingApplications.delete(application.uid);
  }
};

export default openapiSyncSlice.reducer;
