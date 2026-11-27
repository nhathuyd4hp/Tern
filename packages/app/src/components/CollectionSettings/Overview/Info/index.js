import React, { useMemo } from 'react';
import { getTotalRequestCountInCollection } from 'utils/collections/';
import { IconFolder, IconWorld, IconApi, IconTag } from '@tabler/icons';
import { areItemsLoading, getItemsLoadStats, getCollectionVersion } from 'utils/collections/index';
import { useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { makeSelectInvalidItemCountForCollection } from 'src/selectors/collections';
import ChangeCollectionVersion from 'components/Sidebar/Collections/Collection/ChangeCollectionVersion';
import ToolHint from 'components/ToolHint';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import StyledWrapper from './StyledWrapper';

const Info = ({ collection }) => {
  const dispatch = useDispatch();
  const totalRequestsInCollection = getTotalRequestCountInCollection(collection);
  const selectInvalidItemCount = useMemo(makeSelectInvalidItemCountForCollection, []);
  const invalidItemCount = useSelector((state) => selectInvalidItemCount(state, collection.uid));

  const isCollectionLoading = areItemsLoading(collection);
  const { loading: itemsLoadingCount, total: totalItems } = getItemsLoadStats(collection);
  const [showChangeVersionModal, setShowChangeVersionModal] = useState(false);
  const [isVersionOverflowing, setIsVersionOverflowing] = useState(false);

  const collectionVersion = getCollectionVersion(collection);

  const versionRef = useRef(null);

  const handleVersionHover = () => {
    const el = versionRef.current;
    if (el) setIsVersionOverflowing(el.scrollWidth > el.clientWidth);
  };

  const globalEnvironments = useSelector((state) => state.globalEnvironments.globalEnvironments);

  const collectionEnvironmentCount = collection.environments?.length || 0;
  const globalEnvironmentCount = globalEnvironments?.length || 0;

  return (
    <StyledWrapper className="w-full flex flex-col h-fit">
      <div className="rounded-lg py-8">
        <div className="grid gap-8">
          {/* Location Row */}
          <div className="flex items-start">
            <div className="icon-box location flex-shrink-0 p-3 rounded-lg">
              <IconFolder className="w-5 h-5" stroke={1.5} />
            </div>
            <div className="ml-4">
              <div className="font-medium" data-testid="info-location-label">Location</div>
              <div className="mt-1 text-muted break-all" data-testid="info-collection-location">
                {collection.pathname}
              </div>
            </div>
          </div>

          <div className="flex items-start group cursor-pointer" onClick={() => setShowChangeVersionModal(true)} data-testid="info-version-row">
            <div className="icon-box version flex-shrink-0 p-3 rounded-lg">
              <IconTag className="w-5 h-5" stroke={1.5} />
            </div>
            <div className="ml-4 h-full flex flex-col justify-start">
              <div className="font-medium h-fit my-auto">Version</div>
              <div className="flex flex-wrap items-center gap-2">
                {collectionVersion ? (
                  <ToolHint
                    text={collectionVersion}
                    toolhintId={`info-version-value-${collection.uid}`}
                    hidden={!isVersionOverflowing}
                    place="top"
                    tooltipStyle={{ maxWidth: '320px', whiteSpace: 'normal', wordBreak: 'break-all' }}
                    className="version-value-wrap"
                  >
                    <span
                      ref={versionRef}
                      className="text-muted version-value"
                      onMouseEnter={handleVersionHover}
                      data-testid="info-version-value"
                    >
                      {collectionVersion}
                    </span>
                  </ToolHint>
                ) : (
                  <span className="text-muted italic" data-testid="info-version-value">Not Set</span>
                )}
                <span className="group-hover:underline text-link" data-testid="info-version-change">change</span>
              </div>
            </div>
          </div>
          {showChangeVersionModal && <ChangeCollectionVersion collectionUid={collection.uid} onClose={() => setShowChangeVersionModal(false)} />}

          {/* Environments Row */}
          <div className="flex items-start">
            <div className="icon-box environments flex-shrink-0 p-3 rounded-lg">
              <IconWorld className="w-5 h-5" stroke={1.5} />
            </div>
            <div className="ml-4">
              <div className="font-medium" data-testid="info-environments-label">Environments</div>
              <div className="mt-1 flex flex-col gap-1">
                <button
                  type="button"
                  className="text-link cursor-pointer hover:underline text-left bg-transparent"
                  data-testid="info-collection-environment-count"
                  onClick={() => {
                    dispatch(
                      addTab({
                        uid: `${collection.uid}-environment-settings`,
                        collectionUid: collection.uid,
                        type: 'environment-settings'
                      })
                    );
                  }}
                >
                  {collectionEnvironmentCount} application environment{collectionEnvironmentCount !== 1 ? 's' : ''}
                </button>
                <button
                  type="button"
                  className="text-link cursor-pointer hover:underline text-left bg-transparent"
                  data-testid="info-global-environment-count"
                  onClick={() => {
                    dispatch(
                      addTab({
                        uid: `${collection.uid}-global-environment-settings`,
                        collectionUid: collection.uid,
                        type: 'global-environment-settings'
                      })
                    );
                  }}
                >
                  {globalEnvironmentCount} global environment{globalEnvironmentCount !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          </div>

          {/* Requests Row */}
          <div className="flex items-start">
            <div className="icon-box requests flex-shrink-0 p-3 rounded-lg">
              <IconApi className="w-5 h-5" stroke={1.5} />
            </div>
            <div className="ml-4">
              <div className="font-medium" data-testid="info-requests-label">Requests</div>
              <div className="mt-1 text-muted" data-testid="info-request-count">
                {
                  isCollectionLoading ? `${totalItems - itemsLoadingCount} out of ${totalItems} requests in the application loaded` : `${totalRequestsInCollection} request${totalRequestsInCollection !== 1 ? 's' : ''} in application`
                }
                {invalidItemCount > 0 ? (
                  <span data-testid="info-invalid-files-count">
                    {' '}· {invalidItemCount} invalid
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </StyledWrapper>
  );
};

export default Info;
