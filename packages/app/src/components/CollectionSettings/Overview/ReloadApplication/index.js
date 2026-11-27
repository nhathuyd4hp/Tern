import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { IconRefresh } from '@tabler/icons';
import Button from 'ui/Button';
import { reloadApplication } from 'providers/ReduxStore/slices/openapi-sync';
import { isItemAFolder } from 'utils/collections/index';
import { getFolderSyncPath, getSyncEntry } from 'utils/openapi-sync-scope';

// Syncs every collection of the application that is connected to an OpenAPI spec; there is nothing to show without one.
const ReloadApplication = ({ application }) => {
  const dispatch = useDispatch();
  const [reloading, setReloading] = useState(false);

  const hasSyncedCollection = (application.items || []).filter(isItemAFolder).some((folder) => {
    const syncFolder = getFolderSyncPath(application, folder);
    return Boolean(syncFolder && getSyncEntry(application, syncFolder)?.sourceUrl);
  });
  if (!hasSyncedCollection) return null;

  const reload = async () => {
    setReloading(true);
    try {
      await dispatch(reloadApplication(application));
    } finally {
      setReloading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" icon={<IconRefresh size={14} />} loading={reloading} disabled={reloading} onClick={reload} data-testid="reload-application">
      Reload application
    </Button>
  );
};

export default ReloadApplication;
