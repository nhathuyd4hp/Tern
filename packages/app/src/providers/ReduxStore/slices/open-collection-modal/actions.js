import toast from 'react-hot-toast';
import { uuid } from 'utils/common';
import { formatIpcError } from 'utils/common/error';
import { callIpc } from 'utils/common/ipc';
import { importApplicationZip } from 'utils/application-archive';
import { selectCollections } from 'src/selectors/collections';
import { savePreferences } from 'providers/ReduxStore/slices/app';
import { browseDirectories, browseFiles, mountCollection, openMultipleCollections } from 'providers/ReduxStore/slices/collections/actions';
import { expandCollection } from 'providers/ReduxStore/slices/collections';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import {
  showOpenCollectionModal,
  showOpenCollectionPage,
  hideOpenCollectionModal,
  folderPickStarted,
  folderSearchStarted,
  folderSearchFinished,
  folderPickEnded,
  folderResultCleared,
  collectionsOpeningStarted,
  collectionsOpeningEnded
} from './index';
import { selectAutoOpenFolderPicker, selectOpenCollectionPathKeys } from './selectors';
import { countOf, getFolderSearchOutcome } from './folder-results';
import { getFolderName, toPathKey } from './collection-paths';

const CHOOSE_FOLDER_PAGE = 'choose-folder';

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

export const openCollectionsFromModal = (collectionPaths) => async (dispatch, getState) => {
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
  const openingId = uuid();
  dispatch(collectionsOpeningStarted(openingId));

  let imported;
  try {
    imported = await importApplicationZip(zipPath);
  } catch (error) {
    toast.error(`Could not import ${getFolderName(zipPath)}. ${formatIpcError(error)}`);
    return;
  } finally {
    dispatch(collectionsOpeningEnded(openingId));
  }
  await dispatch(openCollectionsFromModal([imported.path]));
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
    dispatch(showOpenCollectionPage(CHOOSE_FOLDER_PAGE));
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

export const saveAutoOpenFolderPicker = (enabled) => (dispatch, getState) => {
  const { preferences } = getState().app;
  const updated = { ...preferences, openCollection: { ...preferences.openCollection, autoOpenFolderPicker: enabled } };
  return dispatch(savePreferences(updated)).catch(() => {
    toast.error('Failed to save preferences');
  });
};

export const openCollectionModal = (page) => (dispatch, getState) => {
  const { isOpen, openingId, chooseFolder } = getState().openCollectionModal;
  if (page !== CHOOSE_FOLDER_PAGE && chooseFolder.searchId) {
    dispatch(cancelCollectionSearch());
  }
  dispatch(isOpen ? showOpenCollectionPage(page) : showOpenCollectionModal(page));

  if (page !== CHOOSE_FOLDER_PAGE || openingId) {
    return;
  }
  if (chooseFolder.result) {
    dispatch(folderResultCleared());
  }
  if (selectAutoOpenFolderPicker(getState())) {
    dispatch(pickCollectionFolders());
  }
};
