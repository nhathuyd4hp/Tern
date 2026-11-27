import { configureStore } from '@reduxjs/toolkit';
import toast from 'react-hot-toast';
import { callIpc } from 'utils/common/ipc';
import { browseDirectories, browseFiles, mountCollection, openMultipleCollections } from 'providers/ReduxStore/slices/collections/actions';
import { updatePreferences } from 'providers/ReduxStore/slices/app';
import { expandCollection } from 'providers/ReduxStore/slices/collections';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import openCollectionModalReducer from './index';
import {
  cancelCollectionSearch,
  closeOpenCollectionModal,
  findCollectionsInFolders,
  openCollectionModal,
  openCollectionsFromModal,
  openDroppedItems,
  pickApplicationZip,
  pickCollectionFolders,
  saveAutoOpenFolderPicker,
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
  openMultipleCollections: jest.fn()
}));

const FIND_IN_FOLDERS = 'renderer:collection-search:find-in-folders';
const CANCEL_SEARCH = 'renderer:collection-search:cancel';

const workspace = { uid: 'workspace-1', collections: [{ path: '/work/open' }, { path: '/work/open-too' }] };
const openCollectionInRedux = {
  uid: 'collection-1',
  pathname: '/work/open',
  collapsed: true,
  mountStatus: 'unmounted',
  brunoConfig: { name: 'Open One' }
};
const otherOpenCollectionInRedux = {
  uid: 'collection-2',
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

const createStore = ({ preferences = {}, modal = closedModal, collections = [openCollectionInRedux, otherOpenCollectionInRedux] } = {}) => {
  const dispatchedActions = [];
  const store = configureStore({
    reducer: {
      openCollectionModal: openCollectionModalReducer,
      app: (state = { preferences }, action) =>
        (action.type === updatePreferences.type ? { ...state, preferences: action.payload } : state),
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

const openOn = (page, chooseFolder = closedModal.chooseFolder) => ({ ...closedModal, isOpen: true, page, chooseFolder });

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

const searchReturns = (result) =>
  callIpc.mockImplementation((channel) => (channel === FIND_IN_FOLDERS ? result : Promise.resolve()));

const droppedFile = { name: 'openapi.yaml' };

const openingReturns = (result) => openMultipleCollections.mockReturnValue(() => result);

describe('open collection modal actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    callIpc.mockResolvedValue(undefined);
    mountCollection.mockImplementation((payload) => ({ type: 'test/mountCollection', payload }));
  });

  describe('openCollectionModal', () => {
    it('opens on Choose folder and opens the folder picker', async () => {
      pickerReturns(Promise.resolve([]));
      const { store } = createStore();

      store.dispatch(openCollectionModal('choose-folder'));
      await flushPromises();

      expect(modalState(store)).toMatchObject({ isOpen: true, page: 'choose-folder' });
      expect(browseDirectories).toHaveBeenCalledTimes(1);
    });

    it('leaves the folder picker closed when the setting is off', () => {
      const { store } = createStore({ preferences: { openCollection: { autoOpenFolderPicker: false } } });

      store.dispatch(openCollectionModal('choose-folder'));

      expect(modalState(store).page).toBe('choose-folder');
      expect(browseDirectories).not.toHaveBeenCalled();
    });

    it('opens other pages without the folder picker', () => {
      const { store } = createStore();

      store.dispatch(openCollectionModal('recents'));

      expect(modalState(store)).toMatchObject({ isOpen: true, page: 'recents' });
      expect(browseDirectories).not.toHaveBeenCalled();
    });

    it('starts Choose folder afresh and picks again when it was showing found collections', async () => {
      pickerReturns(Promise.resolve([]));
      const { store } = createStore({ modal: openOn('recents', { ...closedModal.chooseFolder, result: listResult }) });

      store.dispatch(openCollectionModal('choose-folder'));
      await flushPromises();

      expect(modalState(store)).toMatchObject({ isOpen: true, page: 'choose-folder' });
      expect(modalState(store).chooseFolder.result).toBeNull();
      expect(browseDirectories).toHaveBeenCalledTimes(1);
    });

    it('keeps the found collections and leaves the folder picker closed while collections are opening', () => {
      const chooseFolder = { ...closedModal.chooseFolder, result: listResult };
      const { store } = createStore({ modal: { ...openOn('recents', chooseFolder), openingId: 'opening-1' } });

      store.dispatch(openCollectionModal('choose-folder'));

      expect(modalState(store).page).toBe('choose-folder');
      expect(modalState(store).chooseFolder.result).toEqual({ ...listResult, note: null });
      expect(browseDirectories).not.toHaveBeenCalled();
    });

    it('starts Choose folder afresh instead of showing an earlier message', async () => {
      pickerReturns(Promise.resolve([]));
      const messageResult = { id: 'search-0', type: 'message', note: { tone: 'info', text: 'notes isn’t a Tern application.' } };
      const { store } = createStore({ modal: openOn('recents', { ...closedModal.chooseFolder, result: messageResult }) });

      store.dispatch(openCollectionModal('choose-folder'));
      await flushPromises();

      expect(modalState(store).chooseFolder.result).toBeNull();
      expect(browseDirectories).toHaveBeenCalledTimes(1);
    });
  });

  describe('pickCollectionFolders', () => {
    it('opens one folder picker at a time', () => {
      pickerReturns(new Promise(() => {}));
      const { store } = createStore({ modal: openOn('choose-folder') });

      store.dispatch(pickCollectionFolders());
      store.dispatch(pickCollectionFolders());

      expect(browseDirectories).toHaveBeenCalledTimes(1);
      expect(modalState(store).chooseFolder.status).toBe('picking');
    });

    it('does not open the folder picker while collections are opening', async () => {
      const { store } = createStore({ modal: { ...openOn('choose-folder'), openingId: 'opening-1' } });

      await store.dispatch(pickCollectionFolders());

      expect(browseDirectories).not.toHaveBeenCalled();
      expect(modalState(store).chooseFolder.status).toBe('idle');
    });

    it('keeps what the page showed when the picker is cancelled', async () => {
      pickerReturns(Promise.resolve([]));
      const { store } = createStore({ modal: openOn('choose-folder', { ...closedModal.chooseFolder, result: listResult }) });

      await store.dispatch(pickCollectionFolders());

      expect(modalState(store).chooseFolder).toEqual({ ...closedModal.chooseFolder, result: listResult });
      expect(callIpc).not.toHaveBeenCalled();
    });

    it('shows an error when the folder picker fails', async () => {
      pickerReturns(Promise.reject(new Error('dialog failed')));
      const { store } = createStore({ modal: openOn('choose-folder') });

      await store.dispatch(pickCollectionFolders());

      expect(toast.error).toHaveBeenCalledWith('An error occurred while opening the folder picker');
      expect(modalState(store).chooseFolder.status).toBe('idle');
    });

    it('does not search when the modal was closed while the picker was open', async () => {
      const picker = deferred();
      pickerReturns(picker.promise);
      const { store } = createStore({ modal: openOn('choose-folder') });

      const pick = store.dispatch(pickCollectionFolders());
      store.dispatch(closeOpenCollectionModal());
      picker.resolve(['/work']);
      await pick;

      expect(callIpc).not.toHaveBeenCalledWith(FIND_IN_FOLDERS, expect.anything());
    });

    it('searches the picked folders', async () => {
      pickerReturns(Promise.resolve(['/work', '/shop']));
      searchReturns(new Promise(() => {}));
      const { store } = createStore({ modal: openOn('choose-folder') });

      store.dispatch(pickCollectionFolders());
      await flushPromises();

      expect(callIpc).toHaveBeenCalledWith(FIND_IN_FOLDERS, { requestId: expect.any(String), paths: ['/work', '/shop'] });
      expect(modalState(store).chooseFolder).toMatchObject({ status: 'searching', searchLabel: '2 folders' });
    });
  });

  describe('findCollectionsInFolders', () => {
    it('shows the folder name while it searches one folder', () => {
      searchReturns(new Promise(() => {}));
      const { store } = createStore({ modal: openOn('choose-folder') });

      store.dispatch(findCollectionsInFolders(['/work/api']));

      expect(modalState(store).chooseFolder).toMatchObject({ status: 'searching', searchLabel: 'api' });
    });

    it('opens a picked collection and closes the modal', async () => {
      searchReturns(Promise.resolve(pickedCollection));
      openingReturns(Promise.resolve({ opened: ['/work/api'], failed: [], invalid: [] }));
      const { store } = createStore({ modal: openOn('choose-folder') });

      await store.dispatch(findCollectionsInFolders(['/work/api']));

      expect(openMultipleCollections).toHaveBeenCalledWith(['/work/api'], { silent: true, dontSendDisplayErrors: true });
      expect(toast.success).toHaveBeenCalledWith('Application added to workspace');
      expect(modalState(store).isOpen).toBe(false);
    });

    it('does not leave the last search’s note on screen when the next pick opens straight away and fails', async () => {
      searchReturns(Promise.resolve(pickedCollection));
      openingReturns(Promise.resolve({ opened: [], failed: [{ path: '/work/api', error: 'Unable to parse opencollection.yml' }], invalid: [] }));
      const lastResult = { id: 'search-0', type: 'message', note: { tone: 'info', text: 'docs isn’t a Tern application.' } };
      const { store } = createStore({ modal: openOn('choose-folder', { ...closedModal.chooseFolder, result: lastResult }) });

      await store.dispatch(findCollectionsInFolders(['/work/api']));

      expect(toast.error).toHaveBeenCalledWith('Failed to open api. Unable to parse opencollection.yml');
      expect(modalState(store)).toMatchObject({ isOpen: true, chooseFolder: { status: 'idle', result: null } });
    });

    it('brings back the last list when the next search is cancelled', () => {
      searchReturns(new Promise(() => {}));
      const { store } = createStore({ modal: openOn('choose-folder', { ...closedModal.chooseFolder, result: listResult }) });

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
      const { store } = createStore({ modal: openOn('choose-folder') });

      await store.dispatch(findCollectionsInFolders(['/work/api', '/work/docs']));

      expect(toast).toHaveBeenCalledWith('docs isn’t an application, so it was skipped.');
      expect(openMultipleCollections).toHaveBeenCalledWith(['/work/api'], expect.anything());
    });

    it('switches to a picked collection that is already open', async () => {
      searchReturns(Promise.resolve(folderResult(
        [{ path: '/work/open', status: 'collection', collectionPaths: ['/work/open'], importableFiles: [] }],
        [{ path: '/work/open', name: 'Open One' }]
      )));
      const { store, dispatchedActions } = createStore({ modal: openOn('choose-folder') });

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
      const { store } = createStore({ modal: openOn('choose-folder') });

      await store.dispatch(findCollectionsInFolders(['/work/open', '/work/open-too']));

      expect(openMultipleCollections).not.toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Those applications are already open');
      expect(modalState(store).isOpen).toBe(false);
    });

    it('cancels the search when another page is opened, so its result never pulls the user back', async () => {
      const search = deferred();
      searchReturns(search.promise);
      const { store } = createStore({ modal: openOn('choose-folder') });

      const searching = store.dispatch(findCollectionsInFolders(['/work']));
      const { searchId } = modalState(store).chooseFolder;
      store.dispatch(openCollectionModal('recents'));
      search.resolve(folderResult(
        [{ path: '/work', status: 'folder', collectionPaths: ['/work/api'], importableFiles: [] }],
        [{ path: '/work/api', name: 'API' }]
      ));
      await searching;

      expect(callIpc).toHaveBeenCalledWith(CANCEL_SEARCH, { requestId: searchId });
      expect(modalState(store)).toMatchObject({ page: 'recents', chooseFolder: { status: 'idle', searchId: null, result: null } });
    });

    it('does not open a collection the search found after the user moved to another page', async () => {
      const search = deferred();
      searchReturns(search.promise);
      const { store } = createStore({ modal: openOn('choose-folder') });

      const searching = store.dispatch(findCollectionsInFolders(['/work/api']));
      store.dispatch(openCollectionModal('recents'));
      search.resolve(pickedCollection);
      await searching;

      expect(openMultipleCollections).not.toHaveBeenCalled();
      expect(modalState(store)).toMatchObject({ isOpen: true, page: 'recents' });
    });

    it('shows the collections found inside a folder', async () => {
      searchReturns(Promise.resolve(folderResult(
        [{ path: '/work', status: 'folder', collectionPaths: ['/work/api', '/work/open'], importableFiles: [] }],
        [{ path: '/work/api', name: 'API' }, { path: '/work/open', name: 'Open One' }]
      )));
      const { store } = createStore({ modal: openOn('choose-folder') });

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
      const { store } = createStore({ modal: openOn('choose-folder') });

      store.dispatch(findCollectionsInFolders(['/work']));
      const { searchId } = modalState(store).chooseFolder;
      store.dispatch(findCollectionsInFolders(['/shop']));

      expect(callIpc).toHaveBeenCalledWith(CANCEL_SEARCH, { requestId: searchId });
      expect(modalState(store).chooseFolder.searchId).not.toBe(searchId);
    });

    it('ignores the result of a search that was cancelled', async () => {
      const search = deferred();
      searchReturns(search.promise);
      const { store } = createStore({ modal: openOn('choose-folder') });

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
      const { store } = createStore({ modal: openOn('choose-folder') });

      store.dispatch(findCollectionsInFolders(['/work']));
      const { searchId } = modalState(store).chooseFolder;
      store.dispatch(closeOpenCollectionModal());

      expect(callIpc).toHaveBeenCalledWith(CANCEL_SEARCH, { requestId: searchId });
    });

    it('shows an error when the search fails', async () => {
      searchReturns(Promise.reject(new Error('disk failure')));
      const { store } = createStore({ modal: openOn('choose-folder') });

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
      const { store } = createStore({ modal: openOn('recents') });

      await store.dispatch(openDroppedItems({ folderPaths: ['/work'], hasFolders: true, files: [] }));

      expect(browseDirectories).not.toHaveBeenCalled();
      expect(callIpc).toHaveBeenCalledWith(FIND_IN_FOLDERS, expect.objectContaining({ paths: ['/work'] }));
      expect(modalState(store).page).toBe('choose-folder');
      expect(modalState(store).chooseFolder.result).toMatchObject({ type: 'list', folders: ['/work'] });
    });

    it('says when files dropped with the folders were left out', async () => {
      searchReturns(Promise.resolve(plainFolderResult));
      const { store } = createStore({ modal: openOn('choose-folder') });

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
        callIpc.mockResolvedValue({ path: '/data/orders' });
        openingReturns(Promise.resolve({ opened: ['/data/orders'], failed: [], invalid: [] }));
        const { store } = createStore({ modal: openOn('choose-folder') });

        await store.dispatch(openDroppedItems({ folderPaths: [], hasFolders: false, files: [{ name: 'orders.ZIP' }] }));

        expect(callIpc).toHaveBeenCalledWith('renderer:import-application-zip', '/downloads/orders.ZIP');
        expect(openMultipleCollections).toHaveBeenCalledWith(['/data/orders'], expect.anything());
        expect(modalState(store).isOpen).toBe(false);
      });

      it('says why a zip could not be imported and opens nothing', async () => {
        callIpc.mockRejectedValue(new Error('Error invoking remote method \'renderer:import-application-zip\': Error: This zip is not a Tern application'));
        const { store } = createStore({ modal: openOn('choose-folder') });

        await store.dispatch(openDroppedItems({ folderPaths: [], hasFolders: false, files: [{ name: 'photos.zip' }] }));

        expect(toast.error).toHaveBeenCalledWith('Could not import photos.zip. This zip is not a Tern application');
        expect(openMultipleCollections).not.toHaveBeenCalled();
        expect(modalState(store).openingId).toBeNull();
      });

      it('imports the zip chosen in the file picker', async () => {
        browseFiles.mockReturnValue(() => Promise.resolve(['/downloads/orders.zip']));
        callIpc.mockResolvedValue({ path: '/data/orders' });
        openingReturns(Promise.resolve({ opened: ['/data/orders'], failed: [], invalid: [] }));
        const { store } = createStore({ modal: openOn('choose-folder') });

        await store.dispatch(pickApplicationZip());

        expect(browseFiles).toHaveBeenCalledWith([{ name: 'Zip files', extensions: ['zip'] }], []);
        expect(callIpc).toHaveBeenCalledWith('renderer:import-application-zip', '/downloads/orders.zip');
      });

      it('does nothing when the file picker is cancelled', async () => {
        browseFiles.mockReturnValue(() => Promise.resolve([]));
        const { store } = createStore({ modal: openOn('choose-folder') });

        await store.dispatch(pickApplicationZip());

        expect(callIpc).not.toHaveBeenCalledWith('renderer:import-application-zip', expect.anything());
      });
    });

    it('says importing from a file is not supported when only files were dropped', async () => {
      const { store } = createStore({ modal: openOn('choose-folder') });

      await store.dispatch(openDroppedItems({ folderPaths: [], hasFolders: false, files: [droppedFile] }));

      expect(toast.error).toHaveBeenCalledWith('Importing an application from a file is not supported. Drop a folder or a .zip');
      expect(modalState(store).page).toBe('choose-folder');
      expect(callIpc).not.toHaveBeenCalledWith(FIND_IN_FOLDERS, expect.anything());
    });

    it('says when the dropped folders cannot be read', async () => {
      const { store } = createStore({ modal: openOn('recents') });

      await store.dispatch(openDroppedItems({ folderPaths: [], hasFolders: true, files: [droppedFile] }));

      expect(toast.error).toHaveBeenCalledWith('Could not read the dropped folders');
      expect(modalState(store).page).toBe('recents');
    });

    it('does nothing when the drop held neither folders nor files', async () => {
      const { store } = createStore({ modal: openOn('recents') });

      await store.dispatch(openDroppedItems({ folderPaths: [], hasFolders: false, files: [] }));

      expect(modalState(store).page).toBe('recents');
    });

    it('ignores a drop while collections are opening', async () => {
      const { store } = createStore({ modal: { ...openOn('recents'), openingId: 'opening-1' } });

      await store.dispatch(openDroppedItems({ folderPaths: ['/work'], hasFolders: true, files: [] }));

      expect(callIpc).not.toHaveBeenCalledWith(FIND_IN_FOLDERS, expect.anything());
      expect(modalState(store).page).toBe('recents');
    });
  });

  describe('openCollectionsFromModal', () => {
    it('keeps the modal open and says why in one toast when nothing opened', async () => {
      openingReturns(Promise.resolve({
        opened: [],
        failed: [{ path: '/work/api', error: 'Unable to parse opencollection.yml: Nested mappings are not allowed\n\n  name: a: b\n' }],
        invalid: []
      }));
      const { store } = createStore({ modal: openOn('choose-folder') });

      await store.dispatch(openCollectionsFromModal(['/work/api']));

      expect(openMultipleCollections).toHaveBeenCalledWith(['/work/api'], { silent: true, dontSendDisplayErrors: true });
      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith('Failed to open api. Unable to parse opencollection.yml: Nested mappings are not allowed');
      expect(modalState(store)).toMatchObject({ isOpen: true, openingId: null });
    });

    it('reports folders that no longer exist', async () => {
      openingReturns(Promise.resolve({ opened: ['/work/api'], failed: [], invalid: ['/work/gone'] }));
      const { store } = createStore({ modal: openOn('choose-folder') });

      await store.dispatch(openCollectionsFromModal(['/work/api', '/work/gone']));

      expect(toast.success).toHaveBeenCalledWith('Application added to workspace');
      expect(toast.error).toHaveBeenCalledWith('Failed to open gone. The application doesn’t exist anymore.');
      expect(modalState(store).isOpen).toBe(false);
    });

    it('counts the failures in one toast when several collections fail to open', async () => {
      openingReturns(Promise.resolve({ opened: [], failed: [{ path: '/work/api', error: 'bad json' }], invalid: ['/work/gone'] }));
      const { store } = createStore({ modal: openOn('choose-folder') });

      await store.dispatch(openCollectionsFromModal(['/work/api', '/work/gone']));

      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith('Failed to open 2 applications');
    });

    it('opens the collections once even when asked twice', () => {
      openingReturns(new Promise(() => {}));
      const { store } = createStore({ modal: openOn('choose-folder') });

      store.dispatch(openCollectionsFromModal(['/work/api']));
      store.dispatch(openCollectionsFromModal(['/work/api']));

      expect(openMultipleCollections).toHaveBeenCalledTimes(1);
      expect(modalState(store).openingId).toEqual(expect.any(String));
    });

    it('stays open while collections are opening, so they cannot be opened a second time', async () => {
      const opening = deferred();
      openingReturns(opening.promise);
      const { store } = createStore({ modal: openOn('choose-folder') });

      const result = store.dispatch(openCollectionsFromModal(['/work/api']));
      store.dispatch(closeOpenCollectionModal());
      store.dispatch(openCollectionsFromModal(['/work/api']));

      expect(modalState(store)).toMatchObject({ isOpen: true, openingId: expect.any(String) });
      expect(openMultipleCollections).toHaveBeenCalledTimes(1);

      opening.resolve({ opened: ['/work/api'], failed: [], invalid: [] });
      await result;

      expect(modalState(store)).toMatchObject({ isOpen: false, openingId: null });
    });

    it('shows an error when opening fails', async () => {
      openingReturns(Promise.reject());
      const { store } = createStore({ modal: openOn('choose-folder') });

      await store.dispatch(openCollectionsFromModal(['/work/api']));

      expect(toast.error).toHaveBeenCalledWith('An error occurred while opening the applications');
      expect(modalState(store)).toMatchObject({ isOpen: true, openingId: null });
    });
  });

  describe('saveAutoOpenFolderPicker', () => {
    beforeEach(() => {
      window.ipcRenderer = { invoke: jest.fn().mockResolvedValue(undefined) };
    });

    afterEach(() => {
      delete window.ipcRenderer;
    });

    it('shows the new setting at once and saves it with the other preferences', async () => {
      const { store } = createStore({ preferences: { general: { defaultLocation: '/collections' } } });

      await store.dispatch(saveAutoOpenFolderPicker(false));

      const updated = { general: { defaultLocation: '/collections' }, openCollection: { autoOpenFolderPicker: false } };
      expect(store.getState().app.preferences).toEqual(updated);
      expect(window.ipcRenderer.invoke).toHaveBeenCalledWith('renderer:save-preferences', updated);
    });

    it('puts the setting back and says so when saving fails', async () => {
      window.ipcRenderer.invoke.mockRejectedValue(new Error('disk full'));
      const preferences = { openCollection: { autoOpenFolderPicker: true } };
      const { store } = createStore({ preferences });

      await store.dispatch(saveAutoOpenFolderPicker(false));

      expect(store.getState().app.preferences).toEqual(preferences);
      expect(toast.error).toHaveBeenCalledWith('Failed to save preferences');
    });

    it('keeps newer preferences when an older save fails', async () => {
      const save = deferred();
      window.ipcRenderer.invoke.mockReturnValue(save.promise);
      const { store } = createStore();

      const saving = store.dispatch(saveAutoOpenFolderPicker(false));
      store.dispatch(updatePreferences({ display: { zoomPercentage: 120 } }));
      save.reject(new Error('disk full'));
      await saving;

      expect(store.getState().app.preferences).toEqual({ display: { zoomPercentage: 120 } });
    });
  });

  describe('switchToCollection', () => {
    it('mounts and expands the collection, shows its settings and closes the modal', () => {
      const { store, dispatchedActions } = createStore({ modal: openOn('choose-folder') });

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
        modal: openOn('choose-folder'),
        collections: [{ ...openCollectionInRedux, collapsed: false, mountStatus: 'mounted' }]
      });

      store.dispatch(switchToCollection('/work/open'));

      expect(mountCollection).not.toHaveBeenCalled();
      expect(dispatchedActions).toContainEqual(addTab({ uid: 'collection-1', collectionUid: 'collection-1', type: 'collection-settings' }));
    });

    it('closes the modal when the collection was closed in the meantime', () => {
      const { store, dispatchedActions } = createStore({ modal: openOn('choose-folder'), collections: [] });

      store.dispatch(switchToCollection('/work/open'));

      expect(dispatchedActions.some((action) => action.type === addTab.type)).toBe(false);
      expect(modalState(store).isOpen).toBe(false);
    });
  });
});
