import { useState, useRef, useEffect } from 'react';
import { getSyncEntry } from 'utils/openapi-sync-scope';
import { useDispatch, useSelector } from 'react-redux';
import {
  IconCategory,
  IconBox,
  IconChevronDown,
  IconEye,
  IconSettings,
  IconDots,
  IconX,
  IconFileCode,
  IconFileOff,
  IconTransform
} from '@tabler/icons';
import OpenAPISyncIcon from 'components/Icons/OpenAPISync';
import { toggleCollectionFileMode } from 'providers/ReduxStore/slices/collections';
import { showMigrateToYmlModal } from 'providers/ReduxStore/slices/collection-migration';
import { getWorkspaceCollections } from 'utils/collections';
import isEqual from 'lodash/isEqual';
import { selectCollections, selectActiveWorkspace } from 'src/selectors/collections';
import { selectFirstTabUidByCollection } from 'src/selectors/tab';
import { addTab, focusTab } from 'providers/ReduxStore/slices/tabs';
import { uuid } from 'utils/common';
import Dropdown from 'components/Dropdown';
import MenuDropdown from 'ui/MenuDropdown';
import EnvironmentSelector from 'components/Environments/EnvironmentSelector';
import ToolHint from 'components/ToolHint';
import JsSandboxMode from 'components/SecuritySettings/JsSandboxMode';
import ActionIcon from 'ui/ActionIcon';
import classNames from 'classnames';
import StyledWrapper from './StyledWrapper';
import { useTheme } from 'providers/Theme';

const readDismissedCollections = () => {
  try {
    const raw = localStorage.getItem('bruno.migrateToYmlPill.dismissed');
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const CollectionHeader = ({ collection, isScratchCollection }) => {
  const dispatch = useDispatch();

  const currentWorkspace = useSelector(selectActiveWorkspace);

  const mountedCollections = useSelector((state) =>
    getWorkspaceCollections({
      collections: selectCollections(state),
      workspaces: state.workspaces.workspaces,
      activeWorkspace: selectActiveWorkspace(state)
    })
      .filter((c) => c.mountStatus === 'mounted')
      .map((c) => ({ uid: c.uid, name: c.name })), isEqual);

  // First open tab per collection (focused when switching to that collection).
  const firstTabUidByCollection = useSelector(selectFirstTabUidByCollection);

  const [migratePillDismissed, setMigratePillDismissed] = useState(true);
  useEffect(() => {
    if (!collection?.pathname) return;
    const dismissed = readDismissedCollections();
    setMigratePillDismissed(dismissed.includes(collection.pathname));
  }, [collection?.pathname]);

  const dismissMigratePill = (e) => {
    e?.stopPropagation();
    if (!collection?.pathname) return;
    const dismissed = readDismissedCollections();
    if (!dismissed.includes(collection.pathname)) {
      dismissed.push(collection.pathname);
      try {
        localStorage.setItem('bruno.migrateToYmlPill.dismissed', JSON.stringify(dismissed));
      } catch { }
    }
    setMigratePillDismissed(true);
  };

  const openMigrateToYmlModal = () => {
    dispatch(
      showMigrateToYmlModal({
        collectionUid: collection.uid,
        collectionPathname: collection.pathname,
        collectionName: collection.name
      })
    );
  };

  const switcherRef = useRef();

  const onSwitcherCreate = (ref) => (switcherRef.current = ref);

  const collectionUpdates = useSelector((state) => state.openapiSync?.collectionUpdates || {});
  const { theme } = useTheme();

  if (!collection) {
    return null;
  }

  const hasOpenApiSyncConfigured = getSyncEntry(collection, '')?.sourceUrl;
  const hasOpenApiUpdates = hasOpenApiSyncConfigured && collectionUpdates[collection.uid]?.hasUpdates;
  const hasOpenApiError = hasOpenApiSyncConfigured && collectionUpdates[collection.uid]?.error;

  const scratchCollectionUid = currentWorkspace?.scratchCollectionUid;

  // Display name and icon based on context
  const displayName = isScratchCollection
    ? 'Home'
    : (collection.name || 'Untitled Application');

  const DisplayIcon = isScratchCollection ? IconCategory : IconBox;

  // Switcher handlers
  const handleSwitchToHome = () => {
    switcherRef.current?.hide();
    if (scratchCollectionUid) {
      dispatch(addTab({
        uid: `${scratchCollectionUid}-overview`,
        collectionUid: scratchCollectionUid,
        type: 'workspaceOverview'
      }));
    }
  };

  const handleSwitchToCollection = (targetCollection) => {
    switcherRef.current?.hide();
    if (!targetCollection?.uid) return;

    const existingTabUid = firstTabUidByCollection[targetCollection.uid];
    if (existingTabUid) {
      dispatch(focusTab({ uid: existingTabUid }));
    } else {
      dispatch(
        addTab({
          uid: targetCollection.uid,
          collectionUid: targetCollection.uid,
          type: 'collection-settings'
        })
      );
    }
  };

  // Collection action handlers
  const viewVariables = () => {
    dispatch(
      addTab({
        uid: uuid(),
        collectionUid: collection.uid,
        type: 'variables'
      })
    );
  };

  const viewCollectionSettings = () => {
    dispatch(
      addTab({
        uid: collection.uid,
        collectionUid: collection.uid,
        type: 'collection-settings'
      })
    );
  };

  const viewOpenApiSync = () => {
    dispatch(addTab({
      uid: uuid(),
      collectionUid: collection.uid,
      type: 'openapi-sync'
    }));
  };

  const handleFileModeClick = () => {
    dispatch(
      toggleCollectionFileMode({
        collectionUid: collection.uid
      })
    );
  };

  // Build overflow menu items for the "..." dropdown
  const overflowMenuItems = [
    { id: 'variables', label: 'Variables', leftSection: IconEye, onClick: viewVariables },
    { id: 'file-mode', label: collection.fileMode ? 'Switch to Code Mode' : 'Switch to File Mode', leftSection: collection.fileMode ? IconFileOff : IconFileCode, onClick: handleFileModeClick },
    ...(!hasOpenApiSyncConfigured
      ? [{ id: 'openapi-sync', label: 'OpenAPI', leftSection: OpenAPISyncIcon, onClick: viewOpenApiSync }]
      : []),
    { id: 'collection-settings', label: 'Application Settings', leftSection: IconSettings, onClick: viewCollectionSettings }
  ];

  const handleDisplayIconClick = (e) => {
    const uid = isScratchCollection ? `${collection.uid}-overview` : collection.uid;
    const type = isScratchCollection ? 'workspaceOverview' : 'collection-settings';
    dispatch(addTab({
      uid: uid,
      collectionUid: collection.uid,
      type: type
    }));
  };

  return (
    <StyledWrapper data-testid="collection-header">
      <div className="flex items-center justify-between gap-2 py-2 px-4">
        {/* Left side: Switcher dropdown or rename input */}
        <div className="collection-switcher">
          <div className="flex flex-row justify-center items-center gap-x-1">
            <DisplayIcon size={18} strokeWidth={1.5} className="cursor-pointer display-icon" onClick={handleDisplayIconClick} />
            <Dropdown
              placement="bottom-start"
              onCreate={onSwitcherCreate}
              appendTo={() => document.body}
              icon={(
                <button className="switcher-trigger">
                  <span data-testid="workspace-switcher-name" className={classNames('switcher-name', { 'scratch-collection': isScratchCollection })}>{displayName}</span>
                  <IconChevronDown size={14} strokeWidth={1.5} className="chevron" />
                </button>
              )}
            >
              <div>
                {currentWorkspace && (
                  <>
                    <div
                      className={classNames('dropdown-item', {
                        'dropdown-item-active': isScratchCollection
                      })}
                      onClick={handleSwitchToHome}
                    >
                      <div className="dropdown-icon">
                        <IconCategory size={16} strokeWidth={1.5} />
                      </div>
                      <span className="dropdown-label collection-header-dropdown-label">
                        Home
                      </span>
                    </div>
                  </>
                )}

                {mountedCollections.length > 0 && (
                  <>
                    <div className="dropdown-separator" />
                    <div className="label-item">Applications</div>
                    {mountedCollections.map((col) => {
                      return (
                        <div
                          key={col.uid}
                          className={classNames('dropdown-item', {
                            'dropdown-item-active': !isScratchCollection && collection.uid === col.uid
                          })}
                          onClick={() => handleSwitchToCollection(col)}
                        >
                          <div className="dropdown-icon">
                            <IconBox size={16} strokeWidth={1.5} />
                          </div>
                          <span className="dropdown-label collection-header-dropdown-label">{col.name || 'Untitled Application'}</span>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </Dropdown>
          </div>
        </div>

        <div className="header-actions flex gap-1.5 items-center">
          {!isScratchCollection && (
            <>
              {collection.format === 'bru' && !migratePillDismissed && (
                <div
                  className="migrate-yml-pill"
                  data-testid="migrate-yml-pill"
                  title="Migrate this application to YML"
                >
                  <button
                    type="button"
                    className="pill-main"
                    onClick={openMigrateToYmlModal}
                  >
                    <IconTransform size={13} strokeWidth={1.5} />
                    <span className="pill-label">Migrate to YML</span>
                  </button>
                  <button
                    type="button"
                    className="pill-dismiss"
                    onClick={dismissMigratePill}
                    aria-label="Dismiss"
                    data-testid="migrate-yml-pill-dismiss"
                  >
                    <IconX size={12} strokeWidth={2} />
                  </button>
                </div>
              )}
              {/* OpenAPI Sync - standalone only when configured and beta enabled */}
              {hasOpenApiSyncConfigured && (
                <ToolHint
                  text={hasOpenApiError ? 'OpenAPI Error' : hasOpenApiUpdates ? 'OpenAPI Updates Available' : 'OpenAPI'}
                  toolhintId="OpenApiSyncToolhintId"
                  place="bottom"
                >
                  <ActionIcon onClick={viewOpenApiSync} aria-label="OpenAPI" size="sm" className="relative">
                    <OpenAPISyncIcon size={15} />
                    {(hasOpenApiUpdates || hasOpenApiError) && (
                      <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hasOpenApiError ? theme.status.danger.text : theme.status.warning.text }} />
                    )}
                  </ActionIcon>
                </ToolHint>
              )}
              {/* JS Sandbox Mode - always visible */}
              <JsSandboxMode collection={collection} />
              {/* Overflow menu */}
              <MenuDropdown items={overflowMenuItems} placement="bottom-end" data-testid="more-actions">
                <ActionIcon label="More actions" size="sm" style={{ border: `1px solid ${theme.border.border1}`, borderRadius: theme.border.radius.base, width: 24, marginRight: 4, marginLeft: 4 }}>
                  <IconDots size={16} strokeWidth={1.5} />
                </ActionIcon>
              </MenuDropdown>
              {/* Environment Selector - always visible */}
              <span>
                <EnvironmentSelector collection={collection} />
              </span>
            </>
          )}
        </div>
      </div>
    </StyledWrapper>
  );
};

export default CollectionHeader;
