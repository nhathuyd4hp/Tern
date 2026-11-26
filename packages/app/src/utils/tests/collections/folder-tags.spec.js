import {
  getInheritedTagSourcesForItem,
  getUniqueTagsFromItems,
  transformCollectionToSaveToExportAsFile,
  transformFolderRootToSave
} from 'utils/collections/index';

const request = ({ uid, name = uid, type = 'http-request', tags, draft, ...rest }) => ({
  uid,
  name,
  type,
  request: {},
  ...(tags ? { tags } : {}),
  ...(draft ? { draft } : {}),
  ...rest
});

// folders must not carry an own `request` key — `isItemAFolder` keys off its absence
const folder = ({ uid, name = uid, tags, draft, items = [], ...rest }) => ({
  uid,
  name,
  type: 'folder',
  items,
  ...(tags ? { root: { meta: { name, tags } } } : {}),
  ...(draft ? { draft } : {}),
  ...rest
});

/**
 * collection
 * ├── outer (tags: smoke, api)
 * │   ├── inner (tags: api, slow)   — `api` is re-declared, `outer` still owns it
 * │   │   └── deep-request (tags: critical)
 * │   └── inner-request
 * ├── untagged-folder
 * │   └── plain-request (tags: smoke)
 * └── root-request
 */
const makeCollection = () => ({
  uid: 'col1',
  items: [
    folder({
      uid: 'outer',
      tags: ['smoke', 'api'],
      items: [
        folder({
          uid: 'inner',
          tags: ['api', 'slow'],
          items: [request({ uid: 'deep-request', tags: ['critical'] })]
        }),
        request({ uid: 'inner-request' })
      ]
    }),
    folder({ uid: 'untagged-folder', items: [request({ uid: 'plain-request', tags: ['smoke'] })] }),
    request({ uid: 'root-request' })
  ]
});

const findItem = (collection, uid) => {
  const walk = (items) => {
    for (const item of items) {
      if (item.uid === uid) return item;
      const found = item.items ? walk(item.items) : null;
      if (found) return found;
    }
    return null;
  };
  return walk(collection.items);
};

describe('getInheritedTagSourcesForItem', () => {
  it('pairs each tag with the folder it came from', () => {
    const collection = makeCollection();

    expect(
      getInheritedTagSourcesForItem(collection, findItem(collection, 'deep-request')).map(({ tag, folder: src }) => [
        tag,
        src.uid
      ])
    ).toEqual([
      ['smoke', 'outer'],
      ['api', 'outer'],
      ['slow', 'inner']
    ]);
  });

  it('attributes a tag declared twice to the outermost folder that declares it', () => {
    const collection = makeCollection();

    const api = getInheritedTagSourcesForItem(collection, findItem(collection, 'deep-request')).filter(
      ({ tag }) => tag === 'api'
    );
    expect(api).toHaveLength(1);
    expect(api[0].folder.uid).toBe('outer');
  });
});

describe('getUniqueTagsFromItems — folder tags', () => {
  const items = [
    folder({
      uid: 'f1',
      tags: ['folder-saved'],
      draft: { meta: { tags: ['folder-draft'] } },
      items: [request({ uid: 'r1', tags: ['request-saved'] })]
    })
  ];

  it('includes folder tags in the collection-wide vocabulary, drafts first', () => {
    expect(getUniqueTagsFromItems(items)).toEqual(['folder-draft', 'request-saved']);
  });

  it('reads a folder\'s saved tags when drafts are excluded', () => {
    expect(getUniqueTagsFromItems(items, { includeDrafts: false })).toEqual(['folder-saved', 'request-saved']);
  });
});

describe('transformFolderRootToSave — tags', () => {
  it('writes the folder\'s unsaved tags into meta', () => {
    const folderItem = folder({
      uid: 'f1',
      name: 'my-folder',
      seq: 2,
      tags: ['saved'],
      draft: { meta: { tags: ['drafted'] }, request: {} },
      root: { meta: { tags: ['saved'] }, request: {} }
    });

    expect(transformFolderRootToSave(folderItem).meta).toEqual({ name: 'my-folder', seq: 2, tags: ['drafted'] });
  });

  it('omits the tags key entirely when the folder has none', () => {
    const folderItem = folder({
      uid: 'f1',
      name: 'my-folder',
      seq: 1,
      draft: { meta: { tags: [] }, request: {} },
      root: { meta: {}, request: {} }
    });

    expect(transformFolderRootToSave(folderItem).meta).not.toHaveProperty('tags');
  });

  it('saves a folder whose root carries no request block', () => {
    const folderItem = folder({ uid: 'f1', name: 'my-folder', seq: 1, root: { meta: { tags: ['saved'] } } });

    const saved = transformFolderRootToSave(folderItem);
    expect(saved.meta.tags).toEqual(['saved']);
    expect(saved.request.headers).toEqual([]);
  });
});

describe('transformCollectionToSaveToExportAsFile — folder tags', () => {
  const collectionOf = (folderRoot) => ({
    name: 'collection',
    items: [folder({ uid: 'f1', name: 'my-folder', seq: 1, root: folderRoot, items: [] })]
  });

  it('carries the folder tags through in the root meta, where an import reads them back', () => {
    const exported = transformCollectionToSaveToExportAsFile(
      collectionOf({ meta: { name: 'my-folder', seq: 1, tags: ['smoke'] } })
    );

    expect(exported.items[0].root.meta).toEqual({ name: 'my-folder', seq: 1, tags: ['smoke'] });
  });

  it('omits the tags key for an untagged folder', () => {
    const exported = transformCollectionToSaveToExportAsFile(collectionOf({ meta: { name: 'my-folder', seq: 1 } }));

    expect(exported.items[0].root.meta).not.toHaveProperty('tags');
  });
});
