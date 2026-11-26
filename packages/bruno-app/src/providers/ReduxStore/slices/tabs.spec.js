import reducer, { addTab, closeTabs, setSidebarRevealRequest } from 'providers/ReduxStore/slices/tabs';
import { getApiSpecTabUid } from 'utils/api-specs';

const COLLECTION_UID = 'col-1';
const PETSTORE_PATH = '/workspace/petstore.yaml';
const ORDERS_PATH = '/workspace/orders.yaml';
const OTHER_COLLECTION_UID = 'col-2';

const openApiSpecTab = (state, pathname, tabName, collectionUid = COLLECTION_UID) => reducer(state, addTab({
  uid: getApiSpecTabUid(collectionUid, pathname),
  collectionUid,
  type: 'api-spec',
  apiSpecPathname: pathname,
  tabName
}));

describe('API spec tabs', () => {
  it('opens a second spec alongside the first instead of replacing it', () => {
    let state = openApiSpecTab(undefined, PETSTORE_PATH, 'petstore.yaml');
    state = openApiSpecTab(state, ORDERS_PATH, 'orders.yaml');

    expect(state.tabs).toHaveLength(2);
    expect(state.tabs.map((tab) => tab.apiSpecPathname)).toEqual([PETSTORE_PATH, ORDERS_PATH]);
    expect(state.activeTabUid).toBe(getApiSpecTabUid(COLLECTION_UID, ORDERS_PATH));
  });

  it('goes back to the tab a spec already has instead of opening it twice', () => {
    let state = openApiSpecTab(undefined, PETSTORE_PATH, 'petstore.yaml');
    state = openApiSpecTab(state, ORDERS_PATH, 'orders.yaml');
    state = openApiSpecTab(state, PETSTORE_PATH, 'petstore.yaml');

    expect(state.tabs).toHaveLength(2);
    expect(state.activeTabUid).toBe(getApiSpecTabUid(COLLECTION_UID, PETSTORE_PATH));
  });

  it('opens the spec as a permanent tab, so opening another one does not replace it', () => {
    const state = openApiSpecTab(undefined, PETSTORE_PATH, 'petstore.yaml');

    expect(state.tabs[0].preview).toBe(false);
  });

  it('gives each workspace its own tab for a spec the two workspaces share', () => {
    let state = openApiSpecTab(undefined, PETSTORE_PATH, 'petstore.yaml');
    state = openApiSpecTab(state, PETSTORE_PATH, 'petstore.yaml', OTHER_COLLECTION_UID);

    expect(state.tabs).toHaveLength(2);
    expect(state.tabs.map((tab) => tab.collectionUid)).toEqual([COLLECTION_UID, OTHER_COLLECTION_UID]);
    expect(state.activeTabUid).toBe(getApiSpecTabUid(OTHER_COLLECTION_UID, PETSTORE_PATH));
  });

  it('closes a spec tab without touching the other one', () => {
    let state = openApiSpecTab(undefined, PETSTORE_PATH, 'petstore.yaml');
    state = openApiSpecTab(state, ORDERS_PATH, 'orders.yaml');

    state = reducer(state, closeTabs({ tabUids: [getApiSpecTabUid(COLLECTION_UID, PETSTORE_PATH)] }));

    expect(state.tabs).toHaveLength(1);
    expect(state.tabs[0].apiSpecPathname).toBe(ORDERS_PATH);
  });

  it('records a sidebar reveal request so a repeat request is distinguishable', () => {
    let state = reducer(undefined, setSidebarRevealRequest({ uid: 'req-1', requestedAt: 100 }));
    expect(state.sidebarRevealRequest).toEqual({ uid: 'req-1', requestedAt: 100 });

    state = reducer(state, setSidebarRevealRequest({ uid: 'req-1', requestedAt: 200 }));
    expect(state.sidebarRevealRequest).toEqual({ uid: 'req-1', requestedAt: 200 });
  });
});
