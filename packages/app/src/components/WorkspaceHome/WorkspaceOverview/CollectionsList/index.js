import React, { useState, useMemo, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  IconBox,
  IconTrash,
  IconEdit,
  IconDots,
  IconX,
  IconFolder
} from '@tabler/icons';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import { mountCollection, showInFolder } from 'providers/ReduxStore/slices/collections/actions';
import { removeCollectionFromWorkspaceAction } from 'providers/ReduxStore/slices/workspaces/actions';
import { getRevealInFolderLabel } from 'utils/common/platform';
import { normalizePath } from 'utils/common/path';
import toast from 'react-hot-toast';
import RenameCollection from 'components/Sidebar/Collections/Collection/RenameCollection';
import RemoveCollections from 'components/Sidebar/Collections/Collection/RemoveCollections';
import DeleteCollection from 'components/Sidebar/Collections/Collection/DeleteCollection';
import Dropdown from 'components/Dropdown';
import StatusBadge from 'ui/StatusBadge';
import StyledWrapper from './StyledWrapper';
import { getApplicationStats } from './getApplicationStats';

const PROTOCOL_LABELS = [
  ['rest', 'REST'],
  ['graphql', 'GraphQL'],
  ['grpc', 'gRPC'],
  ['websocket', 'WebSocket']
];

const hasOpenApiSync = (application) => !!application.brunoConfig?.openapi?.some((entry) => entry.sourceUrl);

const ApplicationStats = ({ application }) => {
  const stats = getApplicationStats(application);
  const isSynced = hasOpenApiSync(application);

  return (
    <div className="application-stats">
      <span className="stat-chip">{stats.collections} {stats.collections === 1 ? 'collection' : 'collections'}</span>
      <span className="stat-chip">{stats.requests} {stats.requests === 1 ? 'request' : 'requests'}</span>
      {PROTOCOL_LABELS.filter(([key]) => stats[key] > 0).map(([key, label]) => (
        <span key={key} className="stat-chip protocol">{label} {stats[key]}</span>
      ))}
      {isSynced && <span className="stat-chip synced">OpenAPI sync</span>}
    </div>
  );
};

const CollectionsList = ({ workspace, viewMode = 'card' }) => {
  const dispatch = useDispatch();
  const { collections } = useSelector((state) => state.collections);
  const dropdownRefs = useRef({});

  const [renameCollectionModalOpen, setRenameCollectionModalOpen] = useState(false);
  const [removeCollectionModalOpen, setRemoveCollectionModalOpen] = useState(false);
  const [deleteCollectionModalOpen, setDeleteCollectionModalOpen] = useState(false);
  const [selectedCollectionUid, setSelectedCollectionUid] = useState(null);

  const unopenableCollections = useMemo(() => {
    return (workspace.unopenableCollections || []).map((wc) => ({
      uid: `unopenable-${wc.path}`,
      name: wc.name,
      pathname: wc.path,
      items: [],
      environments: [],
      isLoaded: false,
      failedToOpen: true,
      brunoConfig: {},
      root: {
        request: {
          headers: [],
          auth: { mode: 'none' },
          vars: { req: [], res: [] },
          script: { req: '', res: '' },
          tests: ''
        },
        docs: ''
      }
    }));
  }, [workspace.unopenableCollections]);

  const workspaceCollections = useMemo(() => {
    if (!workspace.collections || workspace.collections.length === 0) {
      return unopenableCollections;
    }

    const filteredCollections = workspace.collections.filter((wc) => {
      if (workspace.scratchTempDirectory) {
        return normalizePath(wc.path) !== normalizePath(workspace.scratchTempDirectory);
      }
      return true;
    });

    const resolvedCollections = filteredCollections.map((wc) => {
      const loadedCollection = collections.find(
        (c) => normalizePath(c.pathname) === normalizePath(wc.path)
      );

      if (loadedCollection) {
        return loadedCollection;
      }

      return {
        uid: `unloaded-${wc.path}`,
        name: wc.name,
        pathname: wc.path,
        items: [],
        environments: [],
        isLoaded: false,
        notFoundLocally: !!wc.notFoundLocally,
        brunoConfig: {},
        root: {
          request: {
            headers: [],
            auth: { mode: 'none' },
            vars: { req: [], res: [] },
            script: { req: '', res: '' },
            tests: ''
          },
          docs: ''
        }
      };
    });

    const unopenablePaths = new Set(unopenableCollections.map((c) => normalizePath(c.pathname)));

    return [
      ...resolvedCollections.filter((c) => !unopenablePaths.has(normalizePath(c.pathname))),
      ...unopenableCollections
    ];
  }, [workspace.collections, workspace.scratchTempDirectory, collections, unopenableCollections]);

  const handleOpenCollectionClick = (collection, event) => {
    if (event.target.closest('.collection-menu')) {
      return;
    }

    if (collection.failedToOpen) {
      toast.error(`Application "${collection.name}" could not be opened`);
      return;
    }

    if (collection.isLoaded === false) {
      toast.error(`Application "${collection.name}" does not exist on disk`);
      return;
    }

    dispatch(
      mountCollection({
        collectionUid: collection.uid,
        collectionPathname: collection.pathname,
        brunoConfig: collection.brunoConfig
      })
    );

    dispatch(
      addTab({
        uid: collection.uid,
        collectionUid: collection.uid,
        type: 'collection-settings'
      })
    );
  };

  const handleRenameCollection = (collection) => {
    dropdownRefs.current[collection.uid]?.hide();
    if (collection.isLoaded === false) {
      toast.error('Cannot rename applications that are not loaded');
      return;
    }
    setSelectedCollectionUid(collection.uid);
    setRenameCollectionModalOpen(true);
  };

  const handleRemoveCollection = (collection) => {
    dropdownRefs.current[collection.uid]?.hide();
    if (collection.failedToOpen || collection.notFoundLocally) {
      dispatch(removeCollectionFromWorkspaceAction(workspace.uid, collection.pathname))
        .then(() => toast.success('Application removed'))
        .catch(() => toast.error('An error occurred while removing the application'));
      return;
    }
    if (collection.isLoaded === false) {
      toast.error('Cannot remove applications that are not loaded');
      return;
    }
    setSelectedCollectionUid(collection.uid);
    setRemoveCollectionModalOpen(true);
  };

  const handleDeleteCollection = (collection) => {
    dropdownRefs.current[collection.uid]?.hide();
    if (collection.isLoaded === false) {
      toast.error('Cannot delete applications that are not loaded');
      return;
    }
    setSelectedCollectionUid(collection.uid);
    setDeleteCollectionModalOpen(true);
  };

  const handleShowInFolder = (collection) => {
    dropdownRefs.current[collection.uid]?.hide();
    dispatch(showInFolder(collection.pathname)).catch((error) => {
      console.error('Error opening the folder', error);
      toast.error('Error opening the collection');
    });
  };

  const renderMenu = (collection) => (
    <div className="collection-menu">
      <Dropdown
        style="new"
        placement="bottom-end"
        onCreate={(ref) => (dropdownRefs.current[collection.uid] = ref)}
        icon={<IconDots size={18} strokeWidth={1.5} />}
      >
        <div className="collection-dropdown">
          {!collection.failedToOpen && (
            <>
              <div
                className="dropdown-item"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRenameCollection(collection);
                }}
              >
                <IconEdit size={16} strokeWidth={1.5} />
                <span>Rename</span>
              </div>
              <div
                className="dropdown-item"
                onClick={(e) => {
                  e.stopPropagation();
                  handleShowInFolder(collection);
                }}
              >
                <IconFolder size={16} strokeWidth={1.5} />
                <span>{getRevealInFolderLabel()}</span>
              </div>
            </>
          )}
          <div
            className="dropdown-item"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveCollection(collection);
            }}
          >
            <IconX size={16} strokeWidth={1.5} />
            <span>Remove</span>
          </div>
          {!collection.failedToOpen && (
            <div
              className="dropdown-item delete-item"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteCollection(collection);
              }}
            >
              <IconTrash size={16} strokeWidth={1.5} />
              <span>Delete</span>
            </div>
          )}
        </div>
      </Dropdown>
    </div>
  );

  return (
    <StyledWrapper>
      {renameCollectionModalOpen && selectedCollectionUid && (
        <RenameCollection
          collectionUid={selectedCollectionUid}
          onClose={() => {
            setRenameCollectionModalOpen(false);
            setSelectedCollectionUid(null);
          }}
        />
      )}

      {removeCollectionModalOpen && selectedCollectionUid && (
        <RemoveCollections
          collectionUid={selectedCollectionUid}
          onClose={() => {
            setRemoveCollectionModalOpen(false);
            setSelectedCollectionUid(null);
          }}
        />
      )}

      {deleteCollectionModalOpen && selectedCollectionUid && (
        <DeleteCollection
          collectionUid={selectedCollectionUid}
          workspaceUid={workspace.uid}
          onClose={() => {
            setDeleteCollectionModalOpen(false);
            setSelectedCollectionUid(null);
          }}
        />
      )}

      {viewMode === 'table' && workspaceCollections.length > 0 ? (
        <table className="applications-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Collections</th>
              <th>Requests</th>
              <th>Protocols</th>
              <th>Sync</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {workspaceCollections.map((collection, index) => {
              const isReadable = collection.isLoaded !== false && !collection.failedToOpen;
              const stats = getApplicationStats(collection);
              return (
                <tr key={collection.uid || index} onClick={(e) => handleOpenCollectionClick(collection, e)}>
                  <td>
                    <div className="collection-header">
                      <div className="collection-icon-wrapper">
                        <IconBox size={16} strokeWidth={1.5} />
                      </div>
                      <div className="collection-name">{collection.name}</div>
                      {collection.failedToOpen && <StatusBadge status="danger" size="xs">Failed to open</StatusBadge>}
                    </div>
                    <div className="collection-path" title={collection.pathname}>{collection.pathname}</div>
                  </td>
                  <td>{isReadable ? stats.collections : '—'}</td>
                  <td>{isReadable ? stats.requests : '—'}</td>
                  <td>
                    {isReadable
                      ? PROTOCOL_LABELS.filter(([key]) => stats[key] > 0).map(([key, label]) => (
                          <span key={key} className="stat-chip protocol">{label} {stats[key]}</span>
                        ))
                      : '—'}
                  </td>
                  <td>{isReadable && hasOpenApiSync(collection) ? <span className="stat-chip synced">OpenAPI sync</span> : '—'}</td>
                  <td className="menu-cell">{renderMenu(collection)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <div className="collections-list">
          {workspaceCollections.length === 0 ? (
            <div className="empty-state">
              <IconBox size={32} strokeWidth={1.5} className="empty-icon" />
              <h3 className="empty-title">No applications yet</h3>
              <p className="empty-description">Create your first application or import an existing one to get started.</p>
            </div>
          ) : (
            workspaceCollections.map((collection, index) => (
              <div
                key={collection.uid || index}
                className="collection-card"
                onClick={(e) => handleOpenCollectionClick(collection, e)}
              >
                <div className="collection-info">
                  <div className="collection-header">
                    <div className="collection-icon-wrapper">
                      <IconBox size={18} strokeWidth={1.5} />
                    </div>
                    <div className="collection-name">{collection.name}</div>
                    {collection.failedToOpen && (
                      <StatusBadge status="danger" size="xs">Failed to open</StatusBadge>
                    )}
                  </div>
                  <div className="collection-path" title={collection.pathname}>{collection.pathname}</div>
                  {collection.isLoaded !== false && !collection.failedToOpen && (
                    <ApplicationStats application={collection} />
                  )}
                </div>
                {renderMenu(collection)}
              </div>
            ))
          )}
        </div>
      )}
    </StyledWrapper>
  );
};

export default CollectionsList;
