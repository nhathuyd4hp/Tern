import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { getTotalRequestCountInCollection, flattenItems } from 'utils/collections/';
import { formatCheckInterval } from '../utils';
import moment from 'moment';
import { IconCheck, IconRefresh, IconRefreshOff } from '@tabler/icons';
import Button from 'ui/Button';
import Toggle from 'ui/Toggle';
import MethodBadge from 'ui/MethodBadge';
import Help from 'components/Help';
import { useTheme } from 'providers/Theme';

const SUMMARY_CARDS = [
  {
    key: 'total',
    label: 'Total in Application',
    color: 'blue',
    tooltip: 'Total endpoints in your application'
  },
  {
    key: 'inSync',
    label: 'In Sync with Spec',
    color: 'green',
    tooltip: 'Endpoints that currently match the latest spec from the source'
  },
  {
    key: 'changed',
    label: 'Changed in Application',
    color: 'muted',
    tooltip: 'Endpoints modified, deleted, or added locally since last sync',
    tab: 'collection-changes'
  },
  {
    key: 'pending',
    label: 'Spec Updates Pending',
    color: 'amber',
    tooltip: 'Spec changes available to sync to your application',
    tab: 'spec-updates'
  }
];

const OverviewSection = ({ collection, storedSpec, collectionDrift, specDrift, remoteDrift, onTabSelect, error, onOpenSettings, onToggleAutoApply }) => {
  const openApiSyncConfig = collection?.brunoConfig?.openapi?.[0];
  const { theme } = useTheme();
  const getMethodColor = (method) => theme.request.methods[method.toLowerCase()] || theme.colors.text.muted;
  const methodCounts = useMemo(() => {
    const counts = {};
    flattenItems(collection?.items || [])
      .filter((item) => item.type === 'http-request')
      .forEach((item) => {
        const method = (item.request?.method || 'GET').toUpperCase();
        counts[method] = (counts[method] || 0) + 1;
      });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [collection?.items]);
  const maxMethodCount = methodCounts[0]?.[1] || 1;

  const reduxError = useSelector((state) => state.openapiSync?.collectionUpdates?.[collection.syncKey || collection.uid]?.error);
  const specMeta = useSelector((state) => state.openapiSync?.storedSpecMeta?.[collection.syncKey || collection.uid] || null);
  const activeError = error || reduxError;

  const version = specMeta?.version;
  const endpointCount = specMeta?.endpointCount ?? null;
  const lastSyncDate = openApiSyncConfig?.lastSyncDate;
  const autoCheckEnabled = openApiSyncConfig?.autoCheck !== false;
  const autoCheckInterval = openApiSyncConfig?.autoCheckInterval || 5;

  // Endpoint Summary counts
  // Total: from collection items in Redux; In Sync: from remote spec comparison
  // Changed/Conflicts: compare against stored spec in AppData (0 on initial sync)
  const hasDriftData = collectionDrift && !collectionDrift.noStoredSpec;

  const totalInCollection = getTotalRequestCountInCollection(collection);

  const inSyncCount = remoteDrift
    ? (remoteDrift.inSync?.length || 0)
    : null;

  const changedInCollection = hasDriftData
    ? (collectionDrift.modified?.length || 0) + (collectionDrift.missing?.length || 0) + (collectionDrift.localOnly?.length || 0)
    : 0;

  const specUpdatesPending = hasDriftData
    ? (specDrift?.added?.length || 0) + (specDrift?.modified?.length || 0) + (specDrift?.removed?.length || 0)
    : (remoteDrift?.modified?.length || 0) + (remoteDrift?.missing?.length || 0);

  // Conflict count: endpoints modified in both spec and collection
  const conflictCount = hasDriftData && specDrift?.modified
    ? (() => {
        const localModifiedIds = new Set((collectionDrift.edited || []).map((ep) => ep.id));
        return specDrift.modified.filter((ep) => localModifiedIds.has(ep.id)).length;
      })()
    : 0;

  const summaryValues = {
    total: totalInCollection,
    inSync: inSyncCount,
    changed: changedInCollection,
    pending: activeError ? null : specDrift ? specUpdatesPending : null
  };

  const details = [
    {
      label: 'Spec Title',
      value: specMeta?.title ? <span className="truncate" title={specMeta.title}>{specMeta.title}</span> : '–'
    },
    { label: 'Spec Version', value: version ? `v${version}` : '–' },
    { label: 'Endpoints in Spec', value: endpointCount != null ? endpointCount : '–' },
    {
      label: 'Last Synced At',
      value: lastSyncDate ? moment(lastSyncDate).fromNow() : '–',
      tooltip: lastSyncDate ? moment(lastSyncDate).format('MMMM D, YYYY [at] h:mm A') : undefined,
      headerExtra: (
        <Help iconComponent={autoCheckEnabled ? IconRefresh : IconRefreshOff} size={14} placement="left" width={240}>
          <div className="font-medium">
            {autoCheckEnabled
              ? `Auto-check every ${formatCheckInterval(autoCheckInterval)}${openApiSyncConfig?.autoApply ? ' · Auto reload' : ''}`
              : 'Auto-check off'}
          </div>
          {autoCheckEnabled
            ? `Tern checks the spec for changes every ${formatCheckInterval(autoCheckInterval, { long: true })}. You can change this in Edit connection settings.`
            : 'Tern does not check the spec for changes on its own. Use Check for updates, or turn it on in Edit connection settings.'}
        </Help>
      )
    }
  ].filter(Boolean);

  const hasCollectionChanges = changedInCollection > 0;
  const hasSpecUpdates = specUpdatesPending > 0;

  const bannerState = useMemo(() => {
    const versionInfo = (specDrift?.storedVersion && specDrift?.newVersion && specDrift.storedVersion !== specDrift.newVersion)
      ? ` (v${specDrift.storedVersion} → v${specDrift.newVersion})`
      : '';

    if (activeError) {
      return {
        variant: 'danger',
        title: 'Failed to check for spec updates',
        subtitle: activeError,
        buttons: ['open-settings']
      };
    }
    if (specDrift?.storedSpecMissing && !lastSyncDate) {
      return {
        variant: 'warning',
        title: 'Initial sync required — your application differs from the spec',
        subtitle: 'Review the changes and sync to bring your application up to date.',
        buttons: ['review']
      };
    }
    if (hasSpecUpdates && hasCollectionChanges) {
      return {
        variant: 'warning',
        title: `OpenAPI spec has new updates${versionInfo} and the application has changes`,
        subtitle: 'New or changed requests are available. Some application changes may be overwritten.',
        buttons: ['sync', 'changes']
      };
    }
    if (hasSpecUpdates) {
      return {
        variant: 'warning',
        title: `OpenAPI spec has new updates${versionInfo}`,
        subtitle: 'New or changed requests are available.',
        buttons: ['sync']
      };
    }
    if (specDrift?.storedSpecMissing && lastSyncDate) {
      return {
        variant: 'warning',
        title: 'Last synced spec not found',
        subtitle: 'The last synced spec is missing in the storage. Restore the latest spec from the source to track application changes.',
        buttons: ['spec-details']
      };
    }
    if (!hasDriftData) return null;
    if (hasCollectionChanges) {
      return {
        variant: 'muted',
        title: 'Application has changes not in the spec',
        subtitle: 'Some requests have been modified or removed and no longer match the spec.',
        buttons: ['changes']
      };
    }
    return null;
  }, [activeError, hasDriftData, hasSpecUpdates, hasCollectionChanges, specDrift?.storedSpecMissing, specDrift?.storedVersion, specDrift?.newVersion, lastSyncDate]);

  return (
    <div className="overview-section">
      {bannerState && (
        <div className={`overview-status-banner ${bannerState.variant}`} data-testid="openapi-sync-overview-banner">
          <div className="banner-text">
            <div className="banner-title-row">
              {bannerState.variant === 'success'
                ? <IconCheck size={16} className="status-check-icon" />
                : <div className={`status-dot ${bannerState.variant}`} />}
              <span className="banner-title">{bannerState.title}</span>
            </div>
            {bannerState.subtitle && (
              <p className="banner-subtitle">{bannerState.subtitle}</p>
            )}
          </div>
          {bannerState.buttons.length > 0 && (
            <div className="banner-button-row">
              {bannerState.buttons.includes('changes') && (
                <Button
                  size="sm"
                  variant={bannerState.buttons.includes('sync') ? 'outline' : 'filled'}
                  color={bannerState.buttons.includes('sync') ? 'secondary' : 'primary'}
                  onClick={() => onTabSelect('collection-changes')}
                >
                  View Application Changes
                </Button>
              )}
              {(bannerState.buttons.includes('sync') || bannerState.buttons.includes('review')) && (
                <Button size="sm" onClick={() => onTabSelect('spec-updates')}>
                  Review and Sync Application
                </Button>
              )}
              {bannerState.buttons.includes('spec-details') && (
                <Button variant="outline" size="sm" onClick={() => onTabSelect('spec-updates')}>
                  Go to Spec Updates
                </Button>
              )}
              {bannerState.buttons.includes('open-settings') && (
                <Button variant="outline" size="sm" onClick={onOpenSettings}>
                  Update connection settings
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      <div className="overview-title-row mt-5">
        <h4 className="overview-section-title">Endpoint Summary</h4>
        <div className="auto-reload-toggle">
          <label className="auto-reload-label">
            Auto Reload
            <Toggle
              size="small"
              checked={autoCheckEnabled && openApiSyncConfig?.autoApply === true}
              disabled={!autoCheckEnabled}
              onChange={() => onToggleAutoApply(openApiSyncConfig?.autoApply !== true)}
              data-testid="auto-apply-toggle"
            />
          </label>
          <Help icon="info" size={11} placement="left" width={240}>
            {autoCheckEnabled
              ? 'Apply spec changes automatically, without asking: new endpoints are added, changed ones updated and removed ones deleted. Your local edits to kept endpoints and requests you added yourself are preserved.'
              : 'Turn on auto-check in Edit connection settings to use auto reload.'}
          </Help>
        </div>
      </div>
      <div className="sync-summary-cards">
        {SUMMARY_CARDS.map(({ key, label, tooltip, tab, color }) => {
          const count = summaryValues[key];
          const resolvedColor = count > 0 ? color : 'muted';
          const isClickable = tab && count > 0;
          return (
            <div
              className={`summary-card${isClickable ? ' clickable' : ''}`}
              key={key}
              onClick={isClickable ? () => onTabSelect(tab) : undefined}
            >
              <span className="card-info-icon">
                <Help icon="info" size={12} placement="top" width={220}>{tooltip}</Help>
              </span>
              <div className="summary-count-row">
                <span className={`summary-count ${resolvedColor}`}>{count != null ? count : '–'}</span>
                {key === 'pending' && conflictCount > 0 && (
                  <span className="conflict-annotation">({conflictCount} {conflictCount === 1 ? 'conflict' : 'conflicts'})</span>
                )}
              </div>
              <div className="summary-label">
                {label}
              </div>
            </div>
          );
        })}
      </div>

      <h4 className="overview-section-title mt-7">Last Synced Spec Details</h4>
      <div className="spec-details-grid">
        {details.map(({ label, labelTooltip, headerExtra, value, tooltip }) => (
          <div className="spec-detail-item" key={label}>
            <div className="spec-detail-header">
              <div className="spec-detail-label">
                {label}
                {labelTooltip && (
                  <Help icon="info" size={11} placement="top" width={220}>{labelTooltip}</Help>
                )}
              </div>
              {headerExtra}
            </div>
            <div className="spec-detail-value">
              {value}
              {tooltip && (
                <Help icon="info" size={11} placement="top" width={200}>{tooltip}</Help>
              )}
            </div>
          </div>
        ))}
      </div>

      {methodCounts.length > 0 && (
        <>
          <h4 className="overview-section-title mt-7">Requests by Method</h4>
          <div className="method-chart" data-testid="openapi-sync-method-stats">
            {methodCounts.map(([method, count]) => (
              <div className="method-chart-row" key={method}>
                <MethodBadge method={method} size="md" />
                <div className="method-chart-track">
                  <div
                    className="method-chart-bar"
                    style={{ width: `${(count / maxMethodCount) * 100}%`, backgroundColor: getMethodColor(method) }}
                  />
                </div>
                <span className="method-chart-count">{count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default OverviewSection;
