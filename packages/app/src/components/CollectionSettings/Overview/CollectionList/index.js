import { useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { IconStack2, IconRefresh, IconSend, IconRoute } from '@tabler/icons';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import { flattenItems, isItemAFolder, isItemARequest } from 'utils/collections/index';
import { getFolderSyncPath, getSyncEntry } from 'utils/openapi-sync-scope';
import { useApplicationColor } from 'utils/application-color';
import { useFlows } from 'utils/flows';
import StyledWrapper from './StyledWrapper';

// The collections of an application (its top-level folders) with a summary, so one can be picked from here.
const CollectionList = ({ collection: application }) => {
  const dispatch = useDispatch();
  const applicationColor = useApplicationColor(application);
  const flows = useFlows(application);

  const rows = useMemo(() => (application.items || []).filter(isItemAFolder).map((folder) => {
    const syncFolder = getFolderSyncPath(application, folder);
    return {
      folder,
      syncFolder,
      requestCount: flattenItems(folder.items || []).filter(isItemARequest).length,
      isSynced: Boolean(syncFolder && getSyncEntry(application, syncFolder)?.sourceUrl)
    };
  }), [application]);

  const totalRequests = rows.reduce((sum, row) => sum + row.requestCount, 0);

  const openFlows = () => dispatch(addTab({ uid: `${application.uid}-flows`, collectionUid: application.uid, type: 'flows' }));

  const openCollection = ({ folder, syncFolder, isSynced }) => {
    dispatch(addTab(isSynced
      ? { uid: `${application.uid}-openapi-sync-${syncFolder}`, collectionUid: application.uid, type: 'openapi-sync', syncFolder, tabName: folder.name }
      : { uid: folder.uid, collectionUid: application.uid, type: 'folder-settings', pathname: folder.pathname }));
  };

  return (
    <StyledWrapper className="mt-4" data-testid="application-collection-list">
      <div className="summary-row">
        <div className="summary-item">
          <IconStack2 size={18} strokeWidth={2} style={{ color: applicationColor }} />
          <span className="summary-count">{rows.length}</span> Collections
        </div>
        <div className="summary-item">
          <IconSend size={18} strokeWidth={2} className="icon-requests" />
          <span className="summary-count">{totalRequests}</span> Requests
        </div>
        <button type="button" className="summary-item summary-link" onClick={openFlows} data-testid="summary-flows">
          <IconRoute size={18} strokeWidth={2} className="icon-flows" />
          <span className="summary-count">{flows.length}</span> Flows
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="empty">No collections yet. Create one from the application menu.</div>
      ) : (
        <div className="collection-table">
          <div className="collection-head">
            <span>Collection</span>
            <span>Requests</span>
            <span>OpenAPI</span>
          </div>
          {rows.map((row) => (
            <button type="button" key={row.folder.uid} className="collection-row" onClick={() => openCollection(row)}>
              <span className="collection-name">
                <IconStack2 size={16} strokeWidth={2} className="collection-icon" style={{ color: applicationColor }} />
                <span className="name-text">{row.folder.name}</span>
              </span>
              <span>{row.requestCount}</span>
              <span className="sync-cell">
                {row.isSynced ? <><IconRefresh size={14} strokeWidth={2} /> Synced</> : '–'}
              </span>
            </button>
          ))}
        </div>
      )}
    </StyledWrapper>
  );
};

export default CollectionList;
