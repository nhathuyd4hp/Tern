import { useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { checkActiveWorkspaceCollectionsForUpdates } from 'providers/ReduxStore/slices/openapi-sync';
import { getWorkspaceCollections } from 'utils/collections';
import { listSyncEntries } from 'utils/openapi-sync-scope';

// Tick rate only; each collection is checked at its own autoCheckInterval inside the thunk.
// Must not exceed the shortest selectable interval (1 minute).
const POLL_INTERVAL = 60 * 1000;

const useOpenAPISyncPolling = () => {
  const dispatch = useDispatch();

  const pollingEnabled = useSelector((state) => state.openapiSync?.pollingEnabled ?? true);
  const collections = useSelector((state) => state.collections?.collections || []);
  const { workspaces, activeWorkspaceUid } = useSelector((state) => state.workspaces);
  const activeWorkspace = workspaces.find((w) => w.uid === activeWorkspaceUid);
  const intervalRef = useRef(null);

  // Filter to only active workspace collections
  const activeWorkspaceCollections = useMemo(
    () => getWorkspaceCollections({ collections, workspaces, activeWorkspace }),
    [activeWorkspace, collections, workspaces]
  );

  // Derive a stable boolean so polling doesn't restart on every collection mutation
  const hasSyncableCollections = useMemo(
    () => activeWorkspaceCollections.some((c) => listSyncEntries(c).some(({ entry }) => entry.autoCheck !== false)),
    [activeWorkspaceCollections]
  );

  useEffect(() => {
    if (!pollingEnabled || !hasSyncableCollections) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initial check after a short delay (to let the app initialize)
    const initialTimeout = setTimeout(() => {
      dispatch(checkActiveWorkspaceCollectionsForUpdates());
    }, 10000); // 10 seconds after app starts

    // Set up polling interval
    intervalRef.current = setInterval(() => {
      dispatch(checkActiveWorkspaceCollectionsForUpdates());
    }, POLL_INTERVAL);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [dispatch, pollingEnabled, hasSyncableCollections]);

  return null;
};

export default useOpenAPISyncPolling;
