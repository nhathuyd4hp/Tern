import toast from 'react-hot-toast';
import { uuid } from 'utils/common';
import { formatIpcError } from 'utils/common/error';
import { callIpc } from 'utils/common/ipc';
import {
  importApplicationFolder,
  importApplicationZip,
  readApplicationFolderName,
  readApplicationZipName
} from 'utils/application-archive';
import { findApplicationByName, selectWorkspaceApplications } from 'utils/application-name';
import { askDuplicateApplication } from 'utils/duplicate-application';
import { selectCollections } from 'src/selectors/collections';
import { browseDirectories, browseFiles, mountCollection, openMultipleCollections, removeCollection } from 'providers/ReduxStore/slices/collections/actions';
import { expandCollection } from 'providers/ReduxStore/slices/collections';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import {
  showOpenCollectionModal,
  hideOpenCollectionModal,
  folderPickStarted,
  folderSearchStarted,
  folderSearchFinished,
  folderPickEnded,
  folderNoteDismissed,
  folderResultCleared,
  collectionsOpeningStarted,
  collectionsOpeningEnded
} from './index';
import { selectOpenCollectionPathKeys } from './selectors';
import { countOf, getFolderSearchOutcome } from './folder-results';
import { getFolderName, toPathKey } from './collection-paths';

const getSearchLabel = (folderPaths) =>
  folderPaths.length === 1 ? getFolderName(folderPaths[0]) : `${folderPaths.length} folders`;

const cancelSearchInMain = (searchId) => callIpc('renderer:collection-search:cancel', { requestId: searchId });

export const closeOpenCollectionModal = () => (dispatch, getState) => {
  const { openingId, chooseFolder } = getState().openCollectionModal;
  if (openingId) {
    return;
  }
  if (chooseFolder.searchId) {
    cancelSearchInMain(chooseFolder.searchId);
  }
  dispatch(hideOpenCollectionModal());
};

export const switchToCollection = (collectionPath) => (dispatch, getState) => {
  const pathKey = toPathKey(collectionPath);
  const collection = selectCollections(getState()).find((item) => toPathKey(item.pathname) === pathKey);
  if (collection) {
    if (collection.mountStatus !== 'mounted' && collection.mountStatus !== 'mounting') {
      dispatch(mountCollection({
        collectionUid: collection.uid,
        collectionPathname: collection.pathname,
        brunoConfig: collection.brunoConfig
      }));
    }
    dispatch(expandCollection(collection.uid));
    dispatch(addTab({ uid: collection.uid, collectionUid: collection.uid, type: 'collection-settings' }));
  }
  dispatch(closeOpenCollectionModal());
};

const describeOpenFailures = (failures) => {
  if (failures.length > 1) {
    return `Failed to open ${countOf(failures.length, 'application')}`;
  }
  const [{ path: collectionPath, error }] = failures;
  return `Failed to open ${getFolderName(collectionPath)}. ${error.split('\n')[0]}`;
};

/**
 * Decide what to do about a name that an application of the workspace already has, before anything is added.
 * Resolves with { name } to go on with, or { stop: 'keep' } when the user keeps the existing one (it is shown),
 * or { stop: 'cancel' } when they give up.
 * "Use the new one" removes the existing application from the workspace; its files stay on disk.
 */
export const resolveApplicationName = (wantedName) => async (dispatch, getState) => {
  const isTaken = (name) => Boolean(findApplicationByName(selectWorkspaceApplications(getState()), name));
  let name = wantedName.trim();
  while (isTaken(name)) {
    const existing = findApplicationByName(selectWorkspaceApplications(getState()), name);
    const answer = await askDuplicateApplication({ name, isTaken });
    if (answer.choice === 'keep') {
      dispatch(switchToCollection(existing.pathname));
      return { stop: 'keep' };
    }
    if (answer.choice === 'replace') {
      await dispatch(removeCollection(existing.uid));
      return { name };
    }
    if (answer.choice !== 'rename') {
      return { stop: 'cancel' };
    }
    name = answer.name.trim();
  }
  return { name };
};

const importFailure = (sourcePath, error) => toast.error(`Could not import ${getFolderName(sourcePath)}. ${formatIpcError(error)}`);

// The new name goes into the copy only when the user chose another one.
const renameOption = (originalName, resolved) => (resolved.name === originalName.trim() ? {} : { name: resolved.name });

/** Import application folders: each one is copied into the applications location, then opened. */
export const openCollectionsFromModal = (folderPaths) => async (dispatch, getState) => {
  if (getState().openCollectionModal.openingId) {
    return;
  }
  for (const folderPath of folderPaths) {
    let name;
    try {
      name = await readApplicationFolderName(folderPath);
    } catch (error) {
      importFailure(folderPath, error);
      continue;
    }
    const resolved = await dispatch(resolveApplicationName(name));
    if (resolved.stop) {
      continue;
    }
    try {
      const imported = await importApplicationFolder(folderPath, renameOption(name, resolved));
      await dispatch(openImportedApplications([imported.path]));
    } catch (error) {
      importFailure(folderPath, error);
    }
  }
};

export const openImportedApplications = (collectionPaths) => async (dispatch, getState) => {
  if (getState().openCollectionModal.openingId) {
    return;
  }
  const openingId = uuid();
  dispatch(collectionsOpeningStarted(openingId));

  let result;
  try {
    result = await dispatch(openMultipleCollections(collectionPaths, { silent: true, dontSendDisplayErrors: true }));
  } catch (error) {
    dispatch(collectionsOpeningEnded(openingId));
    toast.error('An error occurred while opening the applications');
    return;
  }

  const failures = [
    ...result.failed,
    ...result.invalid.map((collectionPath) => ({ path: collectionPath, error: 'The application doesn’t exist anymore.' }))
  ];
  if (result.opened.length > 0) {
    toast.success(result.opened.length === 1 ? 'Application added to workspace' : 'Applications added to workspace');
  }
  if (failures.length > 0) {
    toast.error(describeOpenFailures(failures));
  }

  dispatch(collectionsOpeningEnded(openingId));
  if (result.opened.length > 0) {
    dispatch(closeOpenCollectionModal());
  }
};

export const findCollectionsInFolders = (folderPaths, droppedFileCount = 0) => async (dispatch, getState) => {
  const { searchId: runningSearchId } = getState().openCollectionModal.chooseFolder;
  if (runningSearchId) {
    cancelSearchInMain(runningSearchId);
  }

  const searchId = uuid();
  dispatch(folderSearchStarted({ searchId, searchLabel: getSearchLabel(folderPaths) }));
  const isCurrentSearch = () => getState().openCollectionModal.chooseFolder.searchId === searchId;

  let searchResult;
  try {
    searchResult = await callIpc('renderer:collection-search:find-in-folders', { requestId: searchId, paths: folderPaths });
  } catch (error) {
    if (isCurrentSearch()) {
      dispatch(folderPickEnded());
      toast.error('Could not inspect that folder');
    }
    return;
  }
  if (!isCurrentSearch()) {
    return;
  }

  const outcome = getFolderSearchOutcome(searchResult, new Set(selectOpenCollectionPathKeys(getState())), droppedFileCount);
  if (outcome.type === 'list' || outcome.type === 'message') {
    dispatch(folderSearchFinished({ searchId, result: { id: searchId, ...outcome } }));
    return;
  }

  dispatch(folderPickEnded());
  dispatch(folderResultCleared());
  if (outcome.skippedText) {
    toast(outcome.skippedText);
  }
  if (outcome.type === 'open') {
    await dispatch(openCollectionsFromModal(outcome.paths));
  } else if (outcome.type === 'switch') {
    toast.success(`${outcome.name} is already open`);
    dispatch(switchToCollection(outcome.path));
  } else {
    toast.success('Those applications are already open');
    dispatch(closeOpenCollectionModal());
  }
};

export const cancelCollectionSearch = () => (dispatch, getState) => {
  cancelSearchInMain(getState().openCollectionModal.chooseFolder.searchId);
  dispatch(folderPickEnded());
};

export const importApplicationFromZip = (zipPath) => async (dispatch, getState) => {
  if (getState().openCollectionModal.openingId) {
    return;
  }
  let name;
  try {
    name = await readApplicationZipName(zipPath);
  } catch (error) {
    importFailure(zipPath, error);
    return;
  }
  const resolved = await dispatch(resolveApplicationName(name));
  if (resolved.stop) {
    return;
  }

  const openingId = uuid();
  dispatch(collectionsOpeningStarted(openingId));

  let imported;
  try {
    imported = await importApplicationZip(zipPath, renameOption(name, resolved));
  } catch (error) {
    importFailure(zipPath, error);
    return;
  } finally {
    dispatch(collectionsOpeningEnded(openingId));
  }
  await dispatch(openImportedApplications([imported.path]));
};

export const openDroppedItems = ({ folderPaths, hasFolders, files }) => async (dispatch, getState) => {
  if (getState().openCollectionModal.openingId) {
    return;
  }
  if (hasFolders && folderPaths.length === 0) {
    toast.error('Could not read the dropped folders');
    return;
  }
  if (folderPaths.length > 0) {
    dispatch(folderNoteDismissed());
    await dispatch(findCollectionsInFolders(folderPaths, files.length));
  } else if (files.length > 0) {
    const zipPaths = files.filter((file) => file.name.toLowerCase().endsWith('.zip')).map((file) => window.ipcRenderer.getFilePath(file));
    if (zipPaths.length === 0) {
      toast.error('Importing an application from a file is not supported. Drop a folder or a .zip');
      return;
    }
    for (const zipPath of zipPaths) {
      await dispatch(importApplicationFromZip(zipPath));
    }
  }
};

export const pickApplicationZip = () => async (dispatch, getState) => {
  if (getState().openCollectionModal.openingId) {
    return;
  }
  let zipPaths;
  try {
    zipPaths = await dispatch(browseFiles([{ name: 'Zip files', extensions: ['zip'] }], []));
  } catch (error) {
    toast.error('An error occurred while opening the file picker');
    return;
  }
  if (zipPaths.length > 0) {
    await dispatch(importApplicationFromZip(zipPaths[0]));
  }
};

export const pickCollectionFolders = () => async (dispatch, getState) => {
  const { openingId, chooseFolder } = getState().openCollectionModal;
  if (openingId || chooseFolder.status !== 'idle') {
    return;
  }
  dispatch(folderPickStarted());

  let folderPaths;
  try {
    folderPaths = await dispatch(browseDirectories());
  } catch (error) {
    dispatch(folderPickEnded());
    toast.error('An error occurred while opening the folder picker');
    return;
  }

  if (getState().openCollectionModal.chooseFolder.status !== 'picking') {
    return;
  }
  if (folderPaths.length === 0) {
    dispatch(folderPickEnded());
    return;
  }
  await dispatch(findCollectionsInFolders(folderPaths));
};

export const openImportApplicationDialog = () => (dispatch) => {
  dispatch(folderResultCleared());
  dispatch(showOpenCollectionModal());
};
