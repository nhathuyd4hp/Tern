import React, { useMemo } from 'react';
import get from 'lodash/get';
import { getTotalRequestCountInCollection, areItemsLoading, getItemsLoadStats, humanizeRequestAuthMode } from 'utils/collections';
import { updateSettingsSelectedTab } from 'providers/ReduxStore/slices/collections';
import { useSelector, useDispatch } from 'react-redux';
import { makeSelectInvalidItemCountForCollection } from 'src/selectors/collections';
import { addTab } from 'providers/ReduxStore/slices/tabs';
import StyledWrapper from './StyledWrapper';

const Info = ({ collection }) => {
  const dispatch = useDispatch();
  const totalRequestsInCollection = getTotalRequestCountInCollection(collection);
  const selectInvalidItemCount = useMemo(makeSelectInvalidItemCountForCollection, []);
  const invalidItemCount = useSelector((state) => selectInvalidItemCount(state, collection.uid));

  const isCollectionLoading = areItemsLoading(collection);
  const { loading: itemsLoadingCount, total: totalItems } = getItemsLoadStats(collection);
  const globalEnvironments = useSelector((state) => state.globalEnvironments.globalEnvironments);

  const root = collection.draft?.root || collection.root;
  const variableCount = [...get(root, 'request.vars.req', []), ...get(root, 'request.vars.res', [])].filter((variable) => variable.enabled).length;
  const authMode = get(root, 'request.auth.mode') || 'none';
  const openSettings = (tab) => dispatch(updateSettingsSelectedTab({ collectionUid: collection.uid, tab }));
  const openEnvironments = (type) => dispatch(addTab({ uid: `${collection.uid}-${type}`, collectionUid: collection.uid, type }));

  const collectionEnvironmentCount = collection.environments?.length || 0;
  const globalEnvironmentCount = globalEnvironments?.length || 0;

  return (
    <StyledWrapper className="w-full mt-6">
      <div className="info-box">
        <table className="info-table" data-testid="info-table">
          <thead>
            <tr>
              <th scope="col">Property</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row" data-testid="info-location-label">Location</th>
              <td className="break-all" data-testid="info-collection-location">{collection.pathname}</td>
            </tr>
            <tr>
              <th scope="row" data-testid="info-requests-label">Requests</th>
              <td data-testid="info-request-count">
                {isCollectionLoading
                  ? `${totalItems - itemsLoadingCount} out of ${totalItems} loaded`
                  : totalRequestsInCollection}
                {invalidItemCount > 0 ? <span data-testid="info-invalid-files-count"> · {invalidItemCount} invalid</span> : null}
              </td>
            </tr>
            <tr>
              <th scope="row" data-testid="info-environments-label">Environments</th>
              <td>
                <button type="button" className="info-link" data-testid="info-collection-environment-count" onClick={() => openEnvironments('environment-settings')}>
                  {collectionEnvironmentCount} application
                </button>
                <span className="info-separator">·</span>
                <button type="button" className="info-link" data-testid="info-global-environment-count" onClick={() => openEnvironments('global-environment-settings')}>
                  {globalEnvironmentCount} global
                </button>
              </td>
            </tr>
            <tr>
              <th scope="row" data-testid="info-variables-label">Variables</th>
              <td>
                <button type="button" className="info-link" data-testid="info-variables-count" onClick={() => openSettings('vars')}>
                  {variableCount}
                </button>
              </td>
            </tr>
            <tr>
              <th scope="row" data-testid="info-auth-label">Auth</th>
              <td>
                <button type="button" className="info-link" data-testid="info-auth-mode" title="Open the auth of the application" onClick={() => openSettings('auth')}>
                  {humanizeRequestAuthMode(authMode)}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </StyledWrapper>
  );
};

export default Info;
