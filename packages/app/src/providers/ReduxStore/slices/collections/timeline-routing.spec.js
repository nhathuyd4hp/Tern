import reducer, {
  initRunRequestEvent,
  runRequestEvent,
  collectionAddOauth2CredentialsByUrl
} from 'providers/ReduxStore/slices/collections';

const COLLECTION_UID = 'col-1';
const ITEM_UID = 'req-1';
const REQUEST_UID = 'run-1';

const makeInitialState = () => ({
  collections: [
    {
      uid: COLLECTION_UID,
      pathname: '/coll',
      items: [
        {
          uid: ITEM_UID,
          name: 'user_info',
          type: 'http-request',
          request: { url: 'https://example.com/userinfo', method: 'GET' }
        }
      ]
    }
  ],
  collectionSortOrder: 'default',
  activeWorkspaceUid: null
});

const scriptedRequestEvent = (overrides = {}) => ({
  type: 'scripted-request',
  collectionUid: COLLECTION_UID,
  itemUid: ITEM_UID,
  requestUid: REQUEST_UID,
  phase: 'pre-request',
  source: 'sendRequest',
  scope: { type: 'collection', sourceFile: 'collection.yml' },
  timestamp: 1000,
  data: {
    request: { method: 'GET', url: 'https://example.com/ping', headers: {}, data: undefined },
    response: { statusCode: 200, statusText: 'OK', headers: {}, data: 'ok', dataBuffer: '', size: 0, duration: 1 }
  },
  ...overrides
});

describe('runRequestEvent — single-request flow', () => {
  test('appends a scripted-request entry to collection.timeline', () => {
    let state = makeInitialState();
    state = reducer(state, initRunRequestEvent({
      requestUid: REQUEST_UID, itemUid: ITEM_UID, collectionUid: COLLECTION_UID
    }));
    state = reducer(state, runRequestEvent(scriptedRequestEvent()));

    const collection = state.collections[0];
    expect(collection.timeline).toHaveLength(1);
    expect(collection.timeline[0]).toEqual(
      expect.objectContaining({
        type: 'scripted-request',
        itemUid: ITEM_UID,
        requestUid: REQUEST_UID,
        phase: 'pre-request',
        source: 'sendRequest',
        scope: { type: 'collection', sourceFile: 'collection.yml' },
        timestamp: 1000
      })
    );
  });

  test('keeps each phase distinct as separate entries', () => {
    let state = makeInitialState();
    state = reducer(state, initRunRequestEvent({
      requestUid: REQUEST_UID, itemUid: ITEM_UID, collectionUid: COLLECTION_UID
    }));
    state = reducer(state, runRequestEvent(scriptedRequestEvent({
      phase: 'pre-request', source: 'sendRequest', timestamp: 100
    })));
    state = reducer(state, runRequestEvent(scriptedRequestEvent({
      phase: 'post-response', source: 'runRequest', timestamp: 200
    })));
    state = reducer(state, runRequestEvent(scriptedRequestEvent({
      phase: 'tests', source: 'sendRequest', timestamp: 300
    })));

    const entries = state.collections[0].timeline;
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.phase)).toEqual(['pre-request', 'post-response', 'tests']);
    expect(entries.map((e) => e.source)).toEqual(['sendRequest', 'runRequest', 'sendRequest']);
  });

  test('ignores stale events whose requestUid no longer matches the item', () => {
    let state = makeInitialState();
    state = reducer(state, initRunRequestEvent({
      requestUid: REQUEST_UID, itemUid: ITEM_UID, collectionUid: COLLECTION_UID
    }));
    // Later invocation moves item.requestUid forward; earlier events must be dropped.
    state = reducer(state, initRunRequestEvent({
      requestUid: 'run-2', itemUid: ITEM_UID, collectionUid: COLLECTION_UID
    }));
    state = reducer(state, runRequestEvent(scriptedRequestEvent({ requestUid: REQUEST_UID })));

    expect(state.collections[0].timeline || []).toHaveLength(0);
  });
});

describe('collectionAddOauth2CredentialsByUrl — timeline', () => {
  const credentials = { access_token: 'abc', expires_in: 60 };
  const debugInfo = { data: [{ request: {}, response: {} }] };

  test('standalone runs push an oauth2 entry into collection.timeline', () => {
    let state = makeInitialState();
    state = reducer(state, collectionAddOauth2CredentialsByUrl({
      collectionUid: COLLECTION_UID,
      folderUid: null,
      itemUid: ITEM_UID,
      url: 'https://idp.example.com/token',
      credentials,
      credentialsId: 'credentials',
      debugInfo
    }));

    const collection = state.collections[0];
    expect(collection.timeline).toHaveLength(1);
    expect(collection.timeline[0]).toEqual(
      expect.objectContaining({ type: 'oauth2', itemUid: ITEM_UID })
    );
  });
});
