import { flattenItems } from 'utils/collections/index';

/**
 * A sync entry in brunoConfig.openapi may carry `folder`: the path (relative to the application root,
 * '/' separated) of the collection (folder) that holds its requests. An entry without `folder` covers
 * the whole application.
 */
export const normalizeSyncFolder = (folder) => (typeof folder === 'string' ? folder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') : '');

export const syncKeyOf = (collectionUid, folder) => {
  const key = normalizeSyncFolder(folder);
  return key ? `${collectionUid}::${key}` : collectionUid;
};

export const getSyncEntry = (collection, folder) => {
  const key = normalizeSyncFolder(folder);
  return (collection?.brunoConfig?.openapi || []).find((entry) => normalizeSyncFolder(entry?.folder) === key) || null;
};

/** Every connected entry of an application as { folder, entry } (folder is '' for the application-wide one). */
export const listSyncEntries = (collection) => (collection?.brunoConfig?.openapi || [])
  .filter((entry) => entry?.sourceUrl)
  .map((entry) => ({ folder: normalizeSyncFolder(entry.folder), entry }));

/** Path of a folder item relative to its application, '/' separated. */
export const getFolderSyncPath = (collection, folderItem) => {
  const base = normalizeSyncFolder(collection.pathname).toLowerCase();
  const target = normalizeSyncFolder(folderItem.pathname);
  return target.toLowerCase().startsWith(`${base}/`) ? target.slice(base.length + 1) : '';
};

export const findFolderItemBySyncPath = (collection, folder) => {
  const key = normalizeSyncFolder(folder).toLowerCase();
  return flattenItems(collection?.items || []).find((item) => item.type === 'folder' && getFolderSyncPath(collection, item).toLowerCase() === key) || null;
};

/**
 * The application as seen by one sync entry. For an application-wide entry that is the application itself.
 * For a folder entry the items are those of the folder, brunoConfig.openapi holds just that entry, and
 * `syncFolder`/`syncKey` tell the sync screen which entry it works on.
 */
export const getSyncScopedCollection = (collection, folder) => {
  const key = normalizeSyncFolder(folder);
  if (!key) return collection;
  const folderItem = findFolderItemBySyncPath(collection, key);
  return {
    ...collection,
    items: folderItem?.items || [],
    brunoConfig: { ...collection.brunoConfig, openapi: [getSyncEntry(collection, key)].filter(Boolean) },
    syncFolder: key,
    syncKey: syncKeyOf(collection.uid, key),
    syncFolderName: folderItem?.name || key.split('/').pop()
  };
};
