import { configureStore } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import { callIpc } from 'utils/common/ipc';
import { browseDirectories, browseFiles, mountCollection, openMultipleCollections, removeCollection } from 'providers/ReduxStore/slices/collections/actions';
import { expandCollection } from 'providers/ReduxStore/slices/collections';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import { askDuplicateApplication } from 'utils/duplicate-application';
import openCollectionModalReducer from './index';
import {
  cancelCollectionSearch,
  closeOpenCollectionModal,
  findCollectionsInFolders,
  openCollectionsFromModal,
  openImportedApplications,
  openDroppedItems,
  openImportApplicationDialog,
  pickApplicationZip,
  pickCollectionFolders,
  switchToCollection
} from './actions';

jest.mock('nanoid', () => {
  let count = 0;
  return { customAlphabet: () => () => `mock-id-${(count += 1)}` };
});
jest.mock('react-hot-toast', () => {
  const mockToast = jest.fn();
  mockToast.success = jest.fn();
  mockToast.error = jest.fn();
  return { __esModule: true, default: mockToast };
});
jest.mock('utils/common/ipc', () => ({ callIpc: jest.fn() }));
jest.mock('providers/ReduxStore/slices/collections/actions', () => ({
  browseDirectories: jest.fn(),
  browseFiles: jest.fn(),
  mountCollection: jest.fn(),
  openMultipleCollections: jest.fn(),
  removeCollection: jest.fn()
}));
jest.mock('utils/duplicate-application', () => ({ askDuplicateApplication: jest.fn() }));

const FIND_IN_FOLDERS = 'renderer:collection-search:find-in-folders';
const CANCEL_SEARCH = 'renderer:collection-search:cancel';

const workspace = { uid: 'workspace-1', collections: [{ path: '/work/open' }, { path: '/work/open-too' }] };
const openCollectionInRedux = {
  uid: 'collection-1',
  name: 'Open One',
  pathname: '/work/open',
  collapsed: true,
  mountStatus: 'unmounted',
  brunoConfig: { name: 'Open One' }
};
const otherOpenCollectionInRedux = {
  uid: 'collection-2',
  name: 'Open Too',
  pathname: '/work/open-too',
  collapsed: false,
  mountStatus: 'mounted',
  brunoConfig: { name: 'Open Too' }
};

const closedModal = openCollectionModalReducer(undefined, { type: 'init' });

const listResult = {
  id: 'search-0',
  type: 'list',
  collections: [{ path: '/work/api', name: 'API' }],
  preselect: [],
  note: { tone: 'info', text: 'Found 1 collection.' }
};

const folderResult = (folders, collections) => ({
  folders,
  collections,
  brokenCollectionPaths: [],
  unreadableFolderCount: 0,
  stoppedEarly: false
});

const pickedCollection = folderResult(
  [{ path: '/work/api', status: 'collection', collectionPaths: ['/work/api'], importableFiles: [] }],
  [{ path: '/work/api', name: 'API' }]
);

const createStore = ({ modal = closedModal, collections = [openCollectionInRedux, otherOpenCollectionInRedux] } = {}) => {
  const dispatchedActions = [];
  const store = configureStore({
    reducer: {
      openCollectionModal: openCollectionModalReducer,
      collections: (state = { collections }) => state,
      workspaces: (state = { workspaces: [workspace], activeWorkspaceUid: workspace.uid }) => state
    },
    preloadedState: { openCollectionModal: modal },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(() => (next) => (action) => {
        dispatchedActions.push(action);
        return next(action);
      })
  });
  return { store, dispatchedActions };
};

const openOn = (chooseFolder = closedModal.chooseFolder) => ({ ...closedModal, isOpen: true, chooseFolder });

const modalState = (store) => store.getState().openCollectionModal;

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const pickerReturns = (result) => browseDirectories.mockReturnValue(() => result);

const baseName = (somePath) => somePath.split('/').pop();

// What the main process answers for the import channels: the name is the folder name, a copy goes to /apps.
const importIpc = (channel, source, options = {}) => {
  if (typeof source !== 'string') return Promise.resolve();
  const name = baseName(source).replace(/\.zip$/i, '');
  if (channel === 'renderer:read-application-folder-name' || channel === 'renderer:read-application-zip-name') {
    return Promise.resolve(name);
  }
  if (channel === 'renderer:import-application-folder' || channel === 'renderer:import-application-zip') {
    return Promise.resolve({ path: `/apps/${name}`, name: options.name || name });
  }
  return Promise.resolve();
};

const searchReturns = (result) =>
  callIpc.mockImplementation((channel, ...args) => (channel === FIND_IN_FOLDERS ? result : importIpc(channel, ...args)));

const droppedFile = { name: 'openapi.yaml' };

const openingReturns = (result) => openMultipleCollections.mockReturnValue(() => result);

describe('open collection modal actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    callIpc.mockImplementation(importIpc);
    mountCollection.mockImplementation((payload) => ({ type: 'test/mountCollection', payload }));
  });

  describe('openImportApplicationDialog', () => {
    it('opens the dialog without opening the folder picker', () => {
      const { store } = createStore();

      store.dispatch(openImportApplicationDialog());

      expect(modalState(store).isOpen).toBe(true);
      expect(browseDirectories).not.toHaveBeenCalled();
    });

    it('starts afresh instead of showing what an earlier import found', () => {
      const { store } = createStore({ modal: openOn({ ...closedModal.chooseFolder, result: listResult }) });

      store.dispatch(openImportApplicationDialog());

      expect(modalState(store).chooseFolder.result).toBeNull();
    });
  });

  describe('pickCollectionFolders', () => {
    it('opens one folder picker at a time', () => {
      pickerReturns(new Promise(() => {}));
      const { store } = createStore({ modal: openOn() });

      store.dispatch(pickCollectionFolders());
      store.dispatch(pickCollectionFolders());

      expect(browseDirectories).toHaveBeenCalledTimes(1);
      expect(modalState(store).chooseFolder.status).toBe('picking');
    });

    it('does not open the folder picker while collections are opening', async () => {
      const { store } = createStore({ modal: { ...openOn(), openingId: 'opening-1' } });

      await store.dispatch(pickCollectionFolders());

      expect(browseDirectories).not.toHaveBeenCalled();
      expect(modalState(store).chooseFolder.status).toBe('idle');
    });

    it('keeps what the page showed when the picker is cancelled', async () => {
      pickerReturns(Promise.resolve([]));
      const { store } = createStore({ modal: openOn({ ...closedModal.chooseFolder, result: listResult }) });

      await store.dispatch(pickCollectionFolders());

      expect(modalState(store).chooseFolder).toEqual({ ...closedModal.chooseFolder, result: listResult });
      expect(callIpc).not.toHaveBeenCalled();
    });

    it('shows an error when the folder picker fails', async () => {
      pickerReturns(Promise.reject(new Error('dialog failed')));
      const { store } = createStore({ modal: openOn() });

      await store.dispatch(pickCollectionFolders());

      expect(toast.error).toHaveBeenCalledWith('An error occurred while opening the folder picker');
      expect(modalState(store).chooseFolder.status).toBe('idle');
    });

    it('does not search when the modal was closed while the picker was open', async () => {
      const picker = deferred();
      pickerReturns(picker.promise);
      const { store } = createStore({ modal: openOn() });

      const pick = store.dispatch(pickCollectionFolders());
      store.dispatch(closeOpenCollectionModal());
      picker.resolve(['/work']);
      await pick;

      expect(callIpc).not.toHaveBeenCalledWith(FIND_IN_FOLDERS, expect.anything());
    });

    it('searches the picked folders', async () => {
      pickerReturns(Promise.resolve(['/work', '/shop']));
      searchReturns(new Promise(() => {}));
      const { store } = createStore({ modal: openOn() });

      store.dispatch(pickCollectionFolders());
      await flushPromises();

      expect(callIpc).toHaveBeenCalledWith(FIND_IN_FOLDERS, { requestId: expect.any(String), paths: ['/work', '/shop'] });
      expect(modalState(store).chooseFolder).toMatchObject({ status: 'searching', searchLabel: '2 folders' });
    });
  });

  describe('findCollectionsInFolders', () => {
    it('shows the folder name while it searches one folder', () => {
      searchReturns(new Promise(() => {}));
      const { store } = createStore({ modal: openOn() });

      store.dispatch(findCollectionsInFolders(['/work/api']));

      expect(modalState(store).chooseFolder).toMatchObject({ status: 'searching', searchLabel: 'api' });
    });

    it('opens a picked collection and closes the modal', async () => {
      searchReturns(Promise.resolve(pickedCollection));
      openingReturns(Promise.resolve({ opened: ['/work/api'], failed: [], invalid: [] }));
      const { store } = createStore({ modal: openOn() });

      await store.dispatch(findCollectionsInFolders(['/work/api']));

      expect(callIpc).toHaveBeenCalledWith('renderer:import-application-folder', '/work/api', {});
      expect(openMultipleCollections).toHaveBeenCalledWith(['/apps/api'], { silent: true, dontSendDisplayErrors: true });
      expect(toast.success).toHaveBeenCalledWith('Application added to workspace');
      expect(modalState(store).isOpen).toBe(false);
    });

    it('does not leave the last search’s note on screen when the next pick opens straight away and fails', async () => {
      searchReturns(Promise.resolve(pickedCollection));
      openingReturns(Promise.resolve({ opened: [], failed: [{ path: '/work/api', error: 'Unable to parse opencollection.yml' }], invalid: [] }));
      const lastResult = { id: 'search-0', type: 'message', note: { tone: 'info', text: 'docs isn’t a Tern application.' } };
      const { store } = createStore({ modal: openOn({ ...closedModal.chooseFolder, result: lastResult }) });

      await store.dispatch(findCollectionsInFolders(['/work/api']));

      expect(toast.error).toHaveBeenCalledWith('Failed to open api. Unable to parse opencollection.yml');
      expect(modalState(store)).toMatchObject({ isOpen: true, chooseFolder: { status: 'idle', result: null } });
    });

    it('brings back the last list when the next search is cancelled', () => {
      searchReturns(new Promise(() => {}));
      const { store } = createStore({ modal: openOn({ ...closedModal.chooseFolder, result: listResult }) });

      store.dispatch(findCollectionsInFolders(['/work/docs']));
      store.dispatch(cancelCollectionSearch());

      expect(modalState(store).chooseFolder).toMatchObject({ status: 'idle', result: listResult });
    });

    it('says which picked folders were skipped when it opens the rest', async () => {
      searchReturns(Promise.resolve(folderResult(
        [
          { path: '/work/api', status: 'collection', collectionPaths: ['/work/api'], importableFiles: [] },
          { path: '/work/docs', status: 'folder', collectionPaths: [], importableFiles: [] }
        ],
        [{ path: '/work/api', name: 'API' }]
      )));
      openingReturns(Promise.resolve({ opened: ['/work/api'], failed: [], invalid: [] }));
      const { store } = createStore({ modal: openOn() });

      await store.dispatch(findCollectionsInFolders(['/work/api', '/work/docs']));

      expect(toast).toHaveBeenCalledWith('docs isn’t an application, so it was skipped.');
      expect(openMultipleCollections).toHaveBeenCalledWith(['/apps/api'], expect.anything());
    });

    it('switches to a picked collection that is already open', async () => {
      searchReturns(Promise.resolve(folderResult(
        [{ path: '/work/open', status: 'collection', collectionPaths: ['/work/open'], importableFiles: [] }],
        [{ path: '/work/open', name: 'Open One' }]
      )));
      const { store, dispatchedActions } = createStore({ modal: openOn() });

      await store.dispatch(findCollectionsInFolders(['/work/open']));

      expect(openMultipleCollections).not.toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Open One is already open');
      expect(dispatchedActions).toContainEqual(expandCollection('collection-1'));
      expect(dispatchedActions).toContainEqual(addTab({ uid: 'collection-1', collectionUid: 'collection-1', type: 'collection-settings' }));
      expect(modalState(store).isOpen).toBe(false);
    });

    it('closes and says so when every picked collection is already open', async () => {
      searchReturns(Promise.resolve(folderResult(
        [
          { path: '/work/open', status: 'collection', collectionPaths: ['/work/open'], importableFiles: [] },
          { path: '/work/open-too', status: 'collection', collectionPaths: ['/work/open-too'], importableFiles: [] }
        ],
        [{ path: '/work/open', name: 'Open One' }, { path: '/work/open-too', name: 'Open Too' }]
      )));
      const { store } = createStore({ modal: openOn() });

      await store.dispatch(findCollectionsInFolders(['/work/open', '/work/open-too']));

      expect(openMultipleCollections).not.toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Those applications are already open');
      expect(modalState(store).isOpen).toBe(false);
    });

    it('shows the collections found inside a folder', async () => {
      searchReturns(Promise.resolve(folderResult(
        [{ path: '/work', status: 'folder', collectionPaths: ['/work/api', '/work/open'], importableFiles: [] }],
        [{ path: '/work/api', name: 'API' }, { path: '/work/open', name: 'Open One' }]
      )));
      const { store } = createStore({ modal: openOn() });

      await store.dispatch(findCollectionsInFolders(['/work']));

      const { status, result } = modalState(store).chooseFolder;
      expect(status).toBe('idle');
      expect(result).toMatchObject({
        id: expect.any(String),
        type: 'list',
        collections: [{ path: '/work/api', name: 'API' }, { path: '/work/open', name: 'Open One' }],
        preselect: []
      });
    });

    it('cancels the search already running when a new one starts', async () => {
      searchReturns(new Promise(() => {}));
      const { store } = createStore({ modal: openOn() });

      store.dispatch(findCollectionsInFolders(['/work']));
      const { searchId } = modalState(store).chooseFolder;
      store.dispatch(findCollectionsInFolders(['/shop']));

      expect(callIpc).toHaveBeenCalledWith(CANCEL_SEARCH, { requestId: searchId });
      expect(modalState(store).chooseFolder.searchId).not.toBe(searchId);
    });

    it('ignores the result of a search that was cancelled', async () => {
      const search = deferred();
      searchReturns(search.promise);
      const { store } = createStore({ modal: openOn() });

      const searching = store.dispatch(findCollectionsInFolders(['/work']));
      const { searchId } = modalState(store).chooseFolder;
      store.dispatch(cancelCollectionSearch());
      search.resolve(pickedCollection);
      await searching;

      expect(callIpc).toHaveBeenCalledWith(CANCEL_SEARCH, { requestId: searchId });
      expect(modalState(store).chooseFolder).toEqual(closedModal.chooseFolder);
      expect(openMultipleCollections).not.toHaveBeenCalled();
    });

    it('cancels the search in the main process when the modal closes', () => {
      searchReturns(new Promise(() => {}));
      const { store } = createStore({ modal: openOn() });

      store.dispatch(findCollectionsInFolders(['/work']));
      const { searchId } = modalState(store).chooseFolder;
      store.dispatch(closeOpenCollectionModal());

      expect(callIpc).toHaveBeenCalledWith(CANCEL_SEARCH, { requestId: searchId });
    });

    it('shows an error when the search fails', async () => {
      searchReturns(Promise.reject(new Error('disk failure')));
      const { store } = createStore({ modal: openOn() });

      await store.dispatch(findCollectionsInFolders(['/work']));

      expect(toast.error).toHaveBeenCalledWith('Could not inspect that folder');
      expect(modalState(store).chooseFolder.status).toBe('idle');
    });
  });

  describe('openDroppedItems', () => {
    const plainFolderResult = folderResult(
      [{ path: '/work', status: 'folder', collectionPaths: ['/work/api'], importableFiles: [] }],
      [{ path: '/work/api', name: 'API' }]
    );

    it('goes to Choose folder and searches the dropped folders without the folder picker', async () => {
      searchReturns(Promise.resolve(plainFolderResult));
      const { store } = createStore({ modal: openOn() });

      await store.dispatch(openDroppedItems({ folderPaths: ['/work'], hasFolders: true, files: [] }));

      expect(browseDirectories).not.toHaveBeenCalled();
      expect(callIpc).toHaveBeenCalledWith(FIND_IN_FOLDERS, expect.objectContaining({ paths: ['/work'] }));
      expect(modalState(store).chooseFolder.result).toMatchObject({ type: 'list', folders: ['/work'] });
    });

    it('says when files dropped with the folders were left out', async () => {
      searchReturns(Promise.resolve(plainFolderResult));
      const { store } = createStore({ modal: openOn() });

      await store.dispatch(openDroppedItems({ folderPaths: ['/work'], hasFolders: true, files: [droppedFile, droppedFile] }));

      expect(modalState(store).chooseFolder.result.note.text).toContain('2 dropped files weren’t opened.');
    });

    describe('with a zip', () => {
      beforeEach(() => {
        window.ipcRenderer = { getFilePath: jest.fn((file) => `/downloads/${file.name}`) };
      });

      afterEach(() => {
        delete window.ipcRenderer;
      });

      it('unpacks a dropped zip and opens the new application', async () => {
        openingReturns(Promise.resolve({ opened: ['/apps/orders'], failed: [], invalid: [] }));
        const { store } = createStore({ modal: openOn() });

        await store.dispatch(openDroppedItems({ folderPaths: [], hasFolders: false, files: [{ name: 'orders.ZIP' }] }));

        expect(callIpc).toHaveBeenCalledWith('renderer:import-application-zip', '/downloads/orders.ZIP', {});
        expect(openMultipleCollections).toHaveBeenCalledWith(['/apps/orders'], expect.anything());
        expect(modalState(store).isOpen).toBe(false);
      });

      it('says why a zip could not be imported and opens nothing', async () => {
        callIpc.mockRejectedValue(new Error('Error invoking remote method \'renderer:import-application-zip\': Error: This zip is not a Tern application'));
        const { store } = createStore({ modal: openOn() });

        await store.dispatch(openDroppedItems({ folderPaths: [], hasFolders: false, files: [{ name: 'photos.zip' }] }));

        expect(toast.error).toHaveBeenCalledWith('Could not import photos.zip. This zip is not a Tern application');
        expect(openMultipleCollections).not.toHaveBeenCalled();
        expect(modalState(store).openingId).toBeNull();
      });

      it('imports the zip chosen in the file picker', async () => {
        browseFiles.mockReturnValue(() => Promise.resolve(['/downloads/orders.zip']));
        openingReturns(Promise.resolve({ opened: ['/apps/orders'], failed: [], invalid: [] }));
        const { store } = createStore({ modal: openOn() });

        await store.dispatch(pickApplicationZip());

        expect(browseFiles).toHaveBeenCalledWith([{ name: 'Zip files', extensions: ['zip'] }], []);
        expect(callIpc).toHaveBeenCalledWith('renderer:import-application-zip', '/downloads/orders.zip', {});
      });

      it('does nothing when the file picker is cancelled', async () => {
        browseFiles.mockReturnValue(() => Promise.resolve([]));
        const { store } = createStore({ modal: openOn() });

        await store.dispatch(pickApplicationZip());

        expect(callIpc).not.toHaveBeenCalledWith('renderer:import-application-zip', expect.anything(), expect.anything());
      });
    });

    it('says importing from a file is not supported when only files were dropped', async () => {
      const { store } = createStore({ modal: openOn() });

      await store.dispatch(openDroppedItems({ folderPaths: [], hasFolders: false, files: [droppedFile] }));

      expect(toast.error).toHaveBeenCalledWith('Importing an application from a file is not supported. Drop a folder or a .zip');
      expect(callIpc).not.toHaveBeenCalledWith(FIND_IN_FOLDERS, expect.anything());
    });

    it('says when the dropped folders cannot be read', async () => {
      const { store } = createStore({ modal: openOn() });

      await store.dispatch(openDroppedItems({ folderPaths: [], hasFolders: true, files: [droppedFile] }));

      expect(toast.error).toHaveBeenCalledWith('Could not read the dropped folders');
    });

    it('does nothing when the drop held neither folders nor files', async () => {
      const { store } = createStore({ modal: openOn() });

      await store.dispatch(openDroppedItems({ folderPaths: [], hasFolders: false, files: [] }));
    });

    it('ignores a drop while collections are opening', async () => {
      const { store } = createStore({ modal: { ...openOn(), openingId: 'opening-1' } });

      await store.dispatch(openDroppedItems({ folderPaths: ['/work'], hasFolders: true, files: [] }));

      expect(callIpc).not.toHaveBeenCalledWith(FIND_IN_FOLDERS, expect.anything());
    });
  });

  describe('openImportedApplications', () => {
    it('keeps the modal open and says why in one toast when nothing opened', async () => {
      openingReturns(Promise.resolve({
        opened: [],
        failed: [{ path: '/work/api', error: 'Unable to parse opencollection.yml: Nested mappings are not allowed\n\n  name: a: b\n' }],
        invalid: []
      }));
      const { store } = createStore({ modal: openOn() });

      await store.dispatch(openImportedApplications(['/work/api']));

      expect(openMultipleCollections).toHaveBeenCalledWith(['/work/api'], { silent: true, dontSendDisplayErrors: true });
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith('Failed to open api. Unable to parse opencollection.yml: Nested mappings are not allowed');
      expect(modalState(store)).toMatchObject({ isOpen: true, openingId: null });
    });

    it('reports folders that no longer exist', async () => {
      openingReturns(Promise.resolve({ opened: ['/work/api'], failed: [], invalid: ['/work/gone'] }));
      const { store } = createStore({ modal: openOn() });

      await store.dispatch(openImportedApplications(['/work/api', '/work/gone']));

      expect(toast.success).toHaveBeenCalledWith('Application added to workspace');
      expect(toast.error).toHaveBeenCalledWith('Failed to open gone. The application doesn’t exist anymore.');
      expect(modalState(store).isOpen).toBe(false);
    });

    it('counts the failures in one toast when several collections fail to open', async () => {
      openingReturns(Promise.resolve({ opened: [], failed: [{ path: '/work/api', error: 'bad json' }], invalid: ['/work/gone'] }));
      const { store } = createStore({ modal: openOn() });

      await store.dispatch(openImportedApplications(['/work/api', '/work/gone']));

      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith('Failed to open 2 applications');
    });

    it('opens the collections once even when asked twice', () => {
      openingReturns(new Promise(() => {}));
      const { store } = createStore({ modal: openOn() });

      store.dispatch(openImportedApplications(['/work/api']));
      store.dispatch(openImportedApplications(['/work/api']));

      expect(openMultipleCollections).toHaveBeenCalledTimes(1);
      expect(modalState(store).openingId).toEqual(expect.any(String));
    });

    it('stays open while collections are opening, so they cannot be opened a second time', async () => {
      const opening = deferred();
      openingReturns(opening.promise);
      const { store } = createStore({ modal: openOn() });

      const result = store.dispatch(openImportedApplications(['/work/api']));
      store.dispatch(closeOpenCollectionModal());
      store.dispatch(openImportedApplications(['/work/api']));

      expect(modalState(store)).toMatchObject({ isOpen: true, openingId: expect.any(String) });
      expect(openMultipleCollections).toHaveBeenCalledTimes(1);

      opening.resolve({ opened: ['/work/api'], failed: [], invalid: [] });
      await result;

      expect(modalState(store)).toMatchObject({ isOpen: false, openingId: null });
    });

    it('shows an error when opening fails', async () => {
      openingReturns(Promise.reject());
      const { store } = createStore({ modal: openOn() });

      await store.dispatch(openImportedApplications(['/work/api']));

      expect(toast.error).toHaveBeenCalledWith('An error occurred while opening the applications');
      expect(modalState(store)).toMatchObject({ isOpen: true, openingId: null });
    });
  });

  describe('a name that is already used', () => {
    const importFolder = (store, folderPath = '/downloads/Open One') => store.dispatch(openCollectionsFromModal([folderPath]));

    beforeEach(() => {
      openingReturns(Promise.resolve({ opened: ['/apps/x'], failed: [], invalid: [] }));
      removeCollection.mockImplementation((uid) => () => Promise.resolve(uid));
    });

    it('imports without asking when the name is free', async () => {
      const { store } = createStore({ modal: openOn() });

      await importFolder(store, '/downloads/Shipping');

      expect(askDuplicateApplication).not.toHaveBeenCalled();
      expect(callIpc).toHaveBeenCalledWith('renderer:import-application-folder', '/downloads/Shipping', {});
    });

    it('asks, ignoring case and spaces, and keeps the existing application when told to', async () => {
      askDuplicateApplication.mockResolvedValue({ choice: 'keep' });
      const { store, dispatchedActions } = createStore({ modal: openOn() });

      await importFolder(store, '/downloads/ open one ');

      expect(askDuplicateApplication).toHaveBeenCalledWith(expect.objectContaining({ name: 'open one' }));
      expect(callIpc).not.toHaveBeenCalledWith('renderer:import-application-folder', expect.anything(), expect.anything());
      expect(openMultipleCollections).not.toHaveBeenCalled();
      expect(dispatchedActions).toContainEqual(addTab({ uid: 'collection-1', collectionUid: 'collection-1', type: 'collection-settings' }));
    });

    it('takes the new application and removes the old one from the workspace when told to', async () => {
      askDuplicateApplication.mockResolvedValue({ choice: 'replace' });
      const { store } = createStore({ modal: openOn() });

      await importFolder(store);

      expect(removeCollection).toHaveBeenCalledWith('collection-1');
      expect(callIpc).toHaveBeenCalledWith('renderer:import-application-folder', '/downloads/Open One', {});
      expect(openMultipleCollections).toHaveBeenCalledWith(['/apps/Open One'], expect.anything());
    });

    it('imports under another name, and asks again when that one is taken as well', async () => {
      askDuplicateApplication
        .mockResolvedValueOnce({ choice: 'rename', name: 'open too' })
        .mockResolvedValueOnce({ choice: 'rename', name: 'Open Three' });
      const { store } = createStore({ modal: openOn() });

      await importFolder(store);

      expect(askDuplicateApplication).toHaveBeenCalledTimes(2);
      expect(callIpc).toHaveBeenCalledWith('renderer:import-application-folder', '/downloads/Open One', { name: 'Open Three' });
    });

    it('does nothing when the question is cancelled', async () => {
      askDuplicateApplication.mockResolvedValue({ choice: 'cancel' });
      const { store } = createStore({ modal: openOn() });

      await importFolder(store);

      expect(callIpc).not.toHaveBeenCalledWith('renderer:import-application-folder', expect.anything(), expect.anything());
      expect(removeCollection).not.toHaveBeenCalled();
      expect(modalState(store).isOpen).toBe(true);
    });

    it('asks about the name in a zip before unpacking it, and passes the other name on', async () => {
      askDuplicateApplication.mockResolvedValue({ choice: 'rename', name: 'Open Zip' });
      const { store } = createStore({ modal: openOn() });
      browseFiles.mockReturnValue(() => Promise.resolve(['/downloads/Open One.zip']));

      await store.dispatch(pickApplicationZip());

      expect(callIpc).toHaveBeenCalledWith('renderer:read-application-zip-name', '/downloads/Open One.zip');
      expect(callIpc).toHaveBeenCalledWith('renderer:import-application-zip', '/downloads/Open One.zip', { name: 'Open Zip' });
    });

    it('does not unpack a zip when the existing application is kept', async () => {
      askDuplicateApplication.mockResolvedValue({ choice: 'keep' });
      const { store } = createStore({ modal: openOn() });
      browseFiles.mockReturnValue(() => Promise.resolve(['/downloads/Open One.zip']));

      await store.dispatch(pickApplicationZip());

      expect(callIpc).not.toHaveBeenCalledWith('renderer:import-application-zip', expect.anything(), expect.anything());
    });
  });

  describe('switchToCollection', () => {
    it('mounts and expands the collection, shows its settings and closes the modal', () => {
      const { store, dispatchedActions } = createStore({ modal: openOn() });

      store.dispatch(switchToCollection('/work/open'));

      expect(mountCollection).toHaveBeenCalledWith({
        collectionUid: 'collection-1',
        collectionPathname: '/work/open',
        brunoConfig: { name: 'Open One' }
      });
      expect(dispatchedActions).toContainEqual(expandCollection('collection-1'));
      expect(dispatchedActions).toContainEqual(addTab({ uid: 'collection-1', collectionUid: 'collection-1', type: 'collection-settings' }));
      expect(modalState(store).isOpen).toBe(false);
    });

    it('leaves a mounted, expanded collection as it is', () => {
      const { store, dispatchedActions } = createStore({
        modal: openOn(),
        collections: [{ ...openCollectionInRedux, collapsed: false, mountStatus: 'mounted' }]
      });

      store.dispatch(switchToCollection('/work/open'));

      expect(mountCollection).not.toHaveBeenCalled();
      expect(dispatchedActions).toContainEqual(addTab({ uid: 'collection-1', collectionUid: 'collection-1', type: 'collection-settings' }));
    });

    it('closes the modal when the collection was closed in the meantime', () => {
      const { store, dispatchedActions } = createStore({ modal: openOn(), collections: [] });

      store.dispatch(switchToCollection('/work/open'));

      expect(dispatchedActions.some((action) => action.type === addTab.type)).toBe(false);
      expect(modalState(store).isOpen).toBe(false);
    });
  });
});
