const { describe, it, expect, jest } = require('@jest/globals');

jest.mock('nanoid', () => {
  let counter = 0;

  return {
    customAlphabet: jest.fn(() => () => {
      counter += 1;
      return `uuid-${counter}`;
    })
  };
});

const {
  deserializeTab,
  hydrateSnapshotLookups,
  hydrateCollectionTabs,
  isActiveTab,
  getActiveTabFromSnapshot,
  serializeTab,
  serializeActiveTab,
  shouldExcludeTab,
  getCollectionSnapshotFromLookups
} = require('./index');

describe('hydrateSnapshotLookups', () => {
  it('builds lookup maps from array-based snapshot schema', () => {
    const snapshot = {
      workspaces: [
        {
          pathname: '/workspaces/main',
          sorting: 'default',
          collections: ['/collections/a']
        }
      ],
      collections: [
        {
          pathname: '/collections/a',
          environment: {
            collection: '/collections/a/environments/Prod.yml',
            global: 'Global'
          },
          selectedEnvironment: 'Prod',
          isOpen: true,
          isMounted: false,
          activeTab: { accessor: 'type', value: 'variables' },
          tabs: [{ type: 'variables', accessor: 'type', permanent: false }]
        }
      ]
    };

    const lookups = hydrateSnapshotLookups(snapshot);
    const collection = lookups.collectionsByPath['/collections/a'];
    const workspace = lookups.workspacesByPath['/workspaces/main'];
    const tabs = lookups.tabsByCollectionPath['/collections/a'];

    expect(collection).toMatchObject({
      pathname: '/collections/a',
      workspacePathname: '/workspaces/main',
      environment: {
        collection: '/collections/a/environments/Prod.yml',
        global: 'Global'
      },
      environmentPath: '/collections/a/environments/Prod.yml',
      selectedEnvironment: 'Prod',
      isOpen: true,
      isMounted: false
    });

    expect(workspace).toMatchObject({
      pathname: '/workspaces/main',
      sorting: 'default',
      collections: ['/collections/a']
    });

    expect(tabs).toMatchObject({
      pathname: '/collections/a',
      activeTab: { accessor: 'type', value: 'variables' }
    });
    expect(Array.isArray(tabs.tabs)).toBe(true);
    expect(tabs.tabs).toHaveLength(1);
  });

  it('builds lookup maps from map-based snapshot schema for backward compatibility', () => {
    const snapshot = {
      workspaces: [
        {
          pathname: '/workspaces/main',
          sorting: 'default',
          collections: ['/collections/a']
        }
      ],
      collections: [
        {
          pathname: '/collections/a',
          environmentPath: 'Prod',
          isOpen: true,
          isMounted: true,
          activeTab: { accessor: 'type', value: 'variables' },
          tabs: [{ type: 'variables', accessor: 'type', permanent: false }]
        }
      ]
    };

    const lookups = hydrateSnapshotLookups(snapshot);
    const collection = lookups.collectionsByPath['/collections/a'];
    const workspace = lookups.workspacesByPath['/workspaces/main'];
    const tabs = lookups.tabsByCollectionPath['/collections/a'];

    expect(collection).toMatchObject({
      pathname: '/collections/a',
      workspacePathname: '/workspaces/main',
      environment: {
        collection: 'Prod',
        global: ''
      },
      environmentPath: 'Prod',
      selectedEnvironment: '',
      isOpen: true,
      isMounted: true
    });

    expect(workspace).toMatchObject({
      pathname: '/workspaces/main',
      sorting: 'default',
      collections: ['/collections/a']
    });

    expect(tabs).toMatchObject({
      pathname: '/collections/a',
      activeTab: { accessor: 'type', value: 'variables' }
    });
    expect(Array.isArray(tabs.tabs)).toBe(true);
    expect(tabs.tabs).toHaveLength(1);

    const windowsSnapshot = {
      workspaces: [
        {
          pathname: 'C:\\workspace',
          sorting: 'default',
          collections: ['C:\\workspace\\collection']
        }
      ],
      collections: [
        {
          pathname: 'C:\\workspace\\collection',
          selectedEnvironment: 'Prod',
          isOpen: true,
          isMounted: true
        }
      ]
    };

    const windowsLookups = hydrateSnapshotLookups(windowsSnapshot);
    expect(windowsLookups.collectionsByPath['C:/workspace/collection']).toMatchObject({
      workspacePathname: 'C:\\workspace',
      selectedEnvironment: 'Prod'
    });
  });

  it('keeps workspace-scoped tab snapshots when same collection exists in multiple workspaces', () => {
    const sharedCollectionPath = '/collections/shared';
    const workspaceAPath = '/workspaces/a';
    const workspaceBPath = '/workspaces/b';

    const snapshot = {
      workspaces: [
        {
          pathname: workspaceAPath,
          sorting: 'default',
          collections: [sharedCollectionPath]
        },
        {
          pathname: workspaceBPath,
          sorting: 'default',
          collections: [sharedCollectionPath]
        }
      ],
      collections: [
        {
          pathname: sharedCollectionPath,
          workspacePathname: workspaceAPath,
          environment: {
            collection: 'env-a',
            global: ''
          },
          selectedEnvironment: 'env-a',
          isOpen: true,
          isMounted: false,
          activeTab: { accessor: 'pathname', value: '/collections/shared/ReqA' },
          tabs: [{ type: 'http-request', accessor: 'pathname', pathname: '/collections/shared/ReqA', permanent: true }]
        },
        {
          pathname: sharedCollectionPath,
          workspacePathname: workspaceBPath,
          environment: {
            collection: 'env-b',
            global: ''
          },
          selectedEnvironment: 'env-b',
          isOpen: true,
          isMounted: false,
          activeTab: { accessor: 'pathname', value: '/collections/shared/ReqB' },
          tabs: [{ type: 'http-request', accessor: 'pathname', pathname: '/collections/shared/ReqB', permanent: true }]
        }
      ]
    };

    const lookups = hydrateSnapshotLookups(snapshot);
    const keyA = `${workspaceAPath}::${sharedCollectionPath}`;
    const keyB = `${workspaceBPath}::${sharedCollectionPath}`;

    expect(lookups.tabsByWorkspaceAndCollectionPath[keyA]).toMatchObject({
      activeTab: { accessor: 'pathname', value: '/collections/shared/ReqA' },
      tabs: [{ pathname: '/collections/shared/ReqA' }]
    });

    expect(lookups.tabsByWorkspaceAndCollectionPath[keyB]).toMatchObject({
      activeTab: { accessor: 'pathname', value: '/collections/shared/ReqB' },
      tabs: [{ pathname: '/collections/shared/ReqB' }]
    });

    expect(lookups.hasWorkspaceScopedTabs).toBe(true);

    expect(getCollectionSnapshotFromLookups(sharedCollectionPath, lookups, workspaceAPath)).toMatchObject({
      selectedEnvironment: 'env-a'
    });
    expect(getCollectionSnapshotFromLookups(sharedCollectionPath, lookups, workspaceBPath)).toMatchObject({
      selectedEnvironment: 'env-b'
    });
  });

  it('prioritizes active workspace collection data in collectionsByPath when later non-active entries would otherwise overwrite it', () => {
    const collectionPath = '/collections/shared';

    const snapshot = {
      activeWorkspacePath: '/workspaces/active',
      workspaces: [
        {
          pathname: '/workspaces/active',
          sorting: 'default',
          collections: [collectionPath]
        },
        {
          pathname: '/workspaces/other',
          sorting: 'default',
          collections: [collectionPath]
        }
      ],
      collections: [
        {
          pathname: collectionPath,
          workspacePathname: '/workspaces/active',
          environment: {
            collection: 'env-active',
            global: ''
          },
          selectedEnvironment: 'env-active',
          isOpen: true,
          isMounted: false
        },
        {
          pathname: collectionPath,
          workspacePathname: '/workspaces/other',
          environment: {
            collection: '',
            global: ''
          },
          selectedEnvironment: '',
          isOpen: false,
          isMounted: false
        }
      ]
    };

    const lookups = hydrateSnapshotLookups(snapshot);

    expect(lookups.collectionsByPath[collectionPath]).toMatchObject({
      selectedEnvironment: 'env-active',
      environment: {
        collection: 'env-active',
        global: ''
      }
    });
  });

  it('keeps workspace-scoped collection lookups distinct when active workspace preference is applied', () => {
    const collectionPath = '/collections/shared';
    const workspaceAPath = '/workspaces/a';
    const workspaceBPath = '/workspaces/b';

    const snapshot = {
      activeWorkspacePath: workspaceAPath,
      workspaces: [
        { pathname: workspaceAPath, sorting: 'default', collections: [collectionPath] },
        { pathname: workspaceBPath, sorting: 'default', collections: [collectionPath] }
      ],
      collections: [
        {
          pathname: collectionPath,
          workspacePathname: workspaceAPath,
          environment: { collection: 'env-a', global: '' },
          selectedEnvironment: 'env-a',
          isOpen: true,
          isMounted: false
        },
        {
          pathname: collectionPath,
          workspacePathname: workspaceBPath,
          environment: { collection: 'env-b', global: '' },
          selectedEnvironment: 'env-b',
          isOpen: true,
          isMounted: false
        }
      ]
    };

    const lookups = hydrateSnapshotLookups(snapshot);

    expect(lookups.collectionsByPath[collectionPath]).toMatchObject({
      selectedEnvironment: 'env-a'
    });
    expect(getCollectionSnapshotFromLookups(collectionPath, lookups, workspaceAPath)).toMatchObject({
      selectedEnvironment: 'env-a'
    });
    expect(getCollectionSnapshotFromLookups(collectionPath, lookups, workspaceBPath)).toMatchObject({
      selectedEnvironment: 'env-b'
    });
  });

  it('prefers blank active workspace collection data over a later non-active entry with environment data', () => {
    const collectionPath = '/collections/shared';

    const snapshot = {
      activeWorkspacePath: '/workspaces/active',
      workspaces: [
        { pathname: '/workspaces/active', sorting: 'default', collections: [collectionPath] },
        { pathname: '/workspaces/other', sorting: 'default', collections: [collectionPath] }
      ],
      collections: [
        {
          pathname: collectionPath,
          workspacePathname: '/workspaces/active',
          environment: { collection: '', global: '' },
          selectedEnvironment: '',
          isOpen: true,
          isMounted: false
        },
        {
          pathname: collectionPath,
          workspacePathname: '/workspaces/other',
          environment: { collection: 'env-other', global: '' },
          selectedEnvironment: 'env-other',
          isOpen: false,
          isMounted: false
        }
      ]
    };

    const lookups = hydrateSnapshotLookups(snapshot);

    expect(lookups.collectionsByPath[collectionPath]).toMatchObject({
      selectedEnvironment: '',
      environment: { collection: '', global: '' }
    });
  });

  it('prefers an active workspace entry with environment data over an earlier blank active entry for the same path', () => {
    const collectionPath = '/collections/shared';
    const activeWorkspacePath = '/workspaces/active';

    const snapshot = {
      activeWorkspacePath,
      workspaces: [
        { pathname: activeWorkspacePath, sorting: 'default', collections: [collectionPath] }
      ],
      collections: [
        {
          pathname: collectionPath,
          workspacePathname: activeWorkspacePath,
          environment: { collection: '', global: '' },
          selectedEnvironment: '',
          isOpen: true,
          isMounted: false
        },
        {
          pathname: collectionPath,
          workspacePathname: activeWorkspacePath,
          environment: { collection: 'env-second', global: '' },
          selectedEnvironment: 'env-second',
          isOpen: true,
          isMounted: false
        }
      ]
    };

    const lookups = hydrateSnapshotLookups(snapshot);

    expect(lookups.collectionsByPath[collectionPath]).toMatchObject({
      selectedEnvironment: 'env-second',
      environment: { collection: 'env-second', global: '' }
    });
  });

  it('uses last-write-wins for collectionsByPath when activeWorkspacePath is absent', () => {
    const collectionPath = '/collections/shared';

    const snapshot = {
      workspaces: [
        { pathname: '/workspaces/a', sorting: 'default', collections: [collectionPath] },
        { pathname: '/workspaces/b', sorting: 'default', collections: [collectionPath] }
      ],
      collections: [
        {
          pathname: collectionPath,
          workspacePathname: '/workspaces/a',
          environment: { collection: 'env-a', global: '' },
          selectedEnvironment: 'env-a',
          isOpen: true,
          isMounted: false
        },
        {
          pathname: collectionPath,
          workspacePathname: '/workspaces/b',
          environment: { collection: 'env-b', global: '' },
          selectedEnvironment: 'env-b',
          isOpen: true,
          isMounted: false
        }
      ]
    };

    const lookups = hydrateSnapshotLookups(snapshot);

    expect(lookups.collectionsByPath[collectionPath]).toMatchObject({
      selectedEnvironment: 'env-b',
      environment: { collection: 'env-b', global: '' }
    });
  });

  it('drops legacy v4 migration tabs from snapshot lookups', () => {
    const snapshot = {
      collections: [
        {
          pathname: '/collections/legacy',
          activeTab: { accessor: 'type', value: 'v4-migration' },
          tabs: [
            { type: 'v4-migration', accessor: 'type', permanent: true },
            { type: 'variables', accessor: 'type', permanent: true }
          ]
        }
      ]
    };

    const lookups = hydrateSnapshotLookups(snapshot);

    expect(lookups.tabsByCollectionPath['/collections/legacy'].tabs).toEqual([
      { type: 'variables', accessor: 'type', permanent: true }
    ]);
  });

  it('drops changelog tabs from snapshot lookups', () => {
    const snapshot = {
      collections: [
        {
          pathname: '/collections/a',
          activeTab: { accessor: 'type', value: 'changelog' },
          tabs: [
            { type: 'changelog', accessor: 'pathname', permanent: true },
            { type: 'variables', accessor: 'type', permanent: true }
          ]
        }
      ]
    };

    const lookups = hydrateSnapshotLookups(snapshot);

    expect(lookups.tabsByCollectionPath['/collections/a'].tabs).toEqual([
      { type: 'variables', accessor: 'type', permanent: true }
    ]);
  });
});

describe('folder-scoped openapi-sync tabs', () => {
  const collection = { uid: 'c1', pathname: '/apps/a', items: [] };
  const syncTab = { uid: 't1', collectionUid: 'c1', type: 'openapi-sync', syncFolder: 'api/users', tabName: 'users', preview: false };

  it('is not excluded from the snapshot', () => {
    expect(shouldExcludeTab(syncTab)).toBeFalsy();
  });

  it('round-trips syncFolder and tabName', () => {
    const serialized = serializeTab(syncTab, collection);
    expect(serialized).toMatchObject({ type: 'openapi-sync', syncFolder: 'api/users', tabName: 'users' });
    expect(deserializeTab(serialized, collection)).toMatchObject({ type: 'openapi-sync', syncFolder: 'api/users', tabName: 'users' });
  });

  it('keeps an application-wide tab without syncFolder, and old snapshots restore as before', () => {
    const serialized = serializeTab({ ...syncTab, syncFolder: undefined, tabName: undefined }, collection);
    expect(serialized).not.toHaveProperty('syncFolder');
    expect(deserializeTab({ type: 'openapi-sync', accessor: 'type', permanent: true }, collection).syncFolder).toBeUndefined();
  });

  it('tells the active folder tab from the application-wide one', () => {
    const active = serializeActiveTab(syncTab, collection);
    expect(active).toEqual({ accessor: 'type', value: 'openapi-sync', syncFolder: 'api/users' });
    expect(isActiveTab(syncTab, active, collection)).toBe(true);
    expect(isActiveTab({ type: 'openapi-sync' }, active, collection)).toBe(false);
    expect(isActiveTab({ type: 'openapi-sync' }, { accessor: 'type', value: 'openapi-sync' }, collection)).toBe(true);
  });
});
