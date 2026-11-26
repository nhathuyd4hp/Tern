import { useMemo, useState } from 'react';
import classnames from 'classnames';
import { useDispatch } from 'react-redux';
import { v4 as uuid } from 'uuid';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import StyledWrapper from './StyledWrapper';
import OpenAPISyncHeader from './OpenAPISyncHeader';
import ConnectSpecForm from './ConnectSpecForm';
import SpecStatusSection from './SpecStatusSection';
import CollectionStatusSection from './CollectionStatusSection';
import ConnectionSettingsModal from './ConnectionSettingsModal';
import DisconnectSyncModal from './DisconnectSyncModal';
import OverviewSection from './OverviewSection';
import useOpenAPISync from './hooks/useOpenAPISync';
import { getSyncScopedCollection } from 'utils/openapi-sync-scope';

const OpenAPISyncTab = ({ collection: application, folder }) => {
  const collection = useMemo(() => getSyncScopedCollection(application, folder), [application, folder]);
  const {
    sourceUrl, setSourceUrl,
    isLoading,
    error, setError,
    fileNotFound,
    specDrift,
    collectionDrift,
    remoteDrift,
    isDriftLoading,
    storedSpec,
    checkForUpdates,
    handleConnect,
    handleDisconnect,
    handleSaveSettings,
    openEndpointInTab,
    reloadDrift
  } = useOpenAPISync(collection);

  const dispatch = useDispatch();
  const openApiSyncConfig = collection?.brunoConfig?.openapi?.[0];
  const isConfigured = !!openApiSyncConfig?.sourceUrl;

  const handleViewSpec = () => {
    dispatch(addTab({
      uid: uuid(),
      collectionUid: collection.uid,
      type: 'openapi-spec',
      syncFolder: collection.syncFolder,
      tabName: collection.syncFolderName
    }));
  };

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  // The sections share one page; the links that used to switch tabs now scroll to the section.
  const scrollToSection = (section) => {
    document.getElementById(`sync-${section}`)?.scrollIntoView({ behavior: 'smooth' });
  };

  const hasDriftData = collectionDrift && !collectionDrift.noStoredSpec;
  const collectionChangesCount = hasDriftData
    ? (collectionDrift.modified?.length || 0) + (collectionDrift.missing?.length || 0) + (collectionDrift.localOnly?.length || 0)
    : 0;
  const specUpdatesCount = hasDriftData
    ? (specDrift?.added?.length || 0) + (specDrift?.modified?.length || 0) + (specDrift?.removed?.length || 0)
    : (remoteDrift?.modified?.length || 0) + (remoteDrift?.missing?.length || 0);

  // The summary cards above already say "0"; the detail lists only appear when there is something to act on
  // (or something to explain: loading, errors, a missing stored spec).
  const showCollectionSection = !hasDriftData || collectionChangesCount > 0;
  const showSpecSection = !hasDriftData || specUpdatesCount > 0 || isLoading || !!error || fileNotFound
    || specDrift?.isValid === false || !!specDrift?.storedSpecMissing;

  const syncStatus = (() => {
    if (isLoading) return 'loading';
    if (error) return 'not-in-sync';
    if (!hasDriftData) return null;
    if (collectionChangesCount > 0 || specUpdatesCount > 0) return 'not-in-sync';
    return 'in-sync';
  })();

  return (
    <StyledWrapper className="flex flex-col h-full relative px-4 pt-4 overflow-auto">
      <div className={classnames('sync-page w-full', { 'flex flex-1 pb-4': !isConfigured })}>

        {/* Setup form when not configured */}
        {!isConfigured && (
          <ConnectSpecForm
            sourceUrl={sourceUrl}
            setSourceUrl={setSourceUrl}
            isLoading={isLoading}
            error={error}
            setError={setError}
            onConnect={handleConnect}
          />
        )}

        {/* Configured: spec header + tabs */}
        {isConfigured && (
          <>
            <OpenAPISyncHeader
              collection={collection}
              spec={storedSpec || specDrift?.newSpec}
              sourceUrl={sourceUrl}
              syncStatus={syncStatus}
              onViewSpec={handleViewSpec}
              onOpenSettings={() => setShowSettingsModal(true)}
              onOpenDisconnect={() => setShowDisconnectModal(true)}
              onCheck={checkForUpdates}
              isLoading={isLoading}
            />

            <div className="sync-tab-content">
              <OverviewSection
                collection={collection}
                storedSpec={storedSpec}
                collectionDrift={collectionDrift}
                specDrift={specDrift}
                remoteDrift={remoteDrift}
                onTabSelect={scrollToSection}
                error={error}
                onOpenSettings={() => setShowSettingsModal(true)}
              />
            </div>

            {showCollectionSection && (
              <div id="sync-collection-changes" className="sync-tab-content">
                <CollectionStatusSection
                  collection={collection}
                  collectionDrift={collectionDrift}
                  reloadDrift={reloadDrift}
                  specDrift={specDrift}
                  storedSpec={storedSpec}
                  lastSyncDate={openApiSyncConfig?.lastSyncDate}
                  onOpenEndpoint={openEndpointInTab}
                  isLoading={isDriftLoading || isLoading}
                  onTabSelect={scrollToSection}
                />
              </div>
            )}

            {showSpecSection && (
              <div id="sync-spec-updates" className="sync-tab-content">
                <SpecStatusSection
                  collection={collection}
                  sourceUrl={sourceUrl}
                  isLoading={isLoading}
                  error={error}
                  setError={setError}
                  fileNotFound={fileNotFound}
                  specDrift={specDrift}
                  storedSpec={storedSpec}
                  collectionDrift={collectionDrift}
                  remoteDrift={remoteDrift}
                  onCheck={checkForUpdates}
                  onOpenSettings={() => setShowSettingsModal(true)}
                />
              </div>
            )}
          </>
        )}

      </div>

      {showSettingsModal && (
        <ConnectionSettingsModal
          collection={collection}
          sourceUrl={sourceUrl}
          onSave={handleSaveSettings}
          onDisconnect={() => {
            setShowSettingsModal(false);
            setShowDisconnectModal(true);
          }}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {showDisconnectModal && (
        <DisconnectSyncModal
          onConfirm={() => {
            setShowDisconnectModal(false);
            handleDisconnect();
          }}
          onClose={() => setShowDisconnectModal(false)}
        />
      )}
    </StyledWrapper>
  );
};

export default OpenAPISyncTab;
