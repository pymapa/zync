import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { syncApi, type SyncStatus } from '../lib/api/sync.api';

interface UseSyncOptions {
  /**
   * Polling interval in milliseconds when sync is in progress.
   * Default: 2000ms (2 seconds)
   */
  pollingInterval?: number;

  /**
   * Callback fired when sync completes successfully
   */
  onSyncComplete?: () => void;

  /**
   * Callback fired when sync fails
   */
  onSyncError?: (error: Error) => void;
}

interface UseSyncResult {
  /**
   * Current sync status
   */
  status: SyncStatus | null;

  /**
   * True if sync has never been run for this user
   */
  hasNeverSynced: boolean;

  /**
   * True if currently syncing
   */
  isSyncing: boolean;

  /**
   * True if loading initial status
   */
  isLoadingStatus: boolean;

  /**
   * Trigger a new sync operation
   */
  startSync: () => void;

  /**
   * Error from starting sync (not from status polling)
   */
  error: Error | null;
}

/**
 * Hook for managing activity sync from Strava.
 *
 * Features:
 * - Triggers async sync operation
 * - Polls status while sync is in progress
 * - Automatically stops polling when sync completes
 * - Provides callbacks for completion/error
 */
export function useSync(options: UseSyncOptions = {}): UseSyncResult {
  const { pollingInterval = 2000 } = options;

  // Use refs for callbacks to avoid stale closures and unnecessary effect re-runs
  const onSyncCompleteRef = useRef(options.onSyncComplete);
  const onSyncErrorRef = useRef(options.onSyncError);
  onSyncCompleteRef.current = options.onSyncComplete;
  onSyncErrorRef.current = options.onSyncError;

  // True from the moment the server accepts a sync request until a terminal
  // state (completed/error) is observed in the status poll.  This is state
  // (not a ref) so that refetchInterval and isSyncing react to it immediately.
  const [syncPending, setSyncPending] = useState(false);

  // Single query for sync status.
  // Polls while the server reports 'syncing' OR while we are waiting for
  // the first poll after kicking off a sync (syncPending).
  const {
    data: statusData,
    isLoading: isLoadingStatus,
    refetch: refetchStatus,
  } = useQuery({
    queryKey: ['syncStatus'],
    queryFn: syncApi.getSyncStatus,
    refetchInterval: (query) =>
      syncPending || query.state.data?.syncStatus?.syncState === 'syncing'
        ? pollingInterval
        : false,
    refetchIntervalInBackground: true,
  });

  const status = statusData?.syncStatus ?? null;
  const hasNeverSynced = statusData?.hasNeverSynced ?? true;

  // Mutation for starting sync - errors handled here only
  const mutation = useMutation({
    mutationFn: () => syncApi.startSync(),
    onSuccess: () => {
      setSyncPending(true);
      refetchStatus();
    },
    onError: (error: Error) => {
      onSyncErrorRef.current?.(error);
    },
  });

  const isSyncing = mutation.isPending || syncPending || status?.syncState === 'syncing';

  // Fire callbacks when a user-initiated sync reaches a terminal state
  useEffect(() => {
    if (!status || !syncPending) {
      return;
    }

    if (status.syncState === 'completed') {
      setSyncPending(false);
      onSyncCompleteRef.current?.();
    }

    if (status.syncState === 'error') {
      setSyncPending(false);
      const errorMessage = status.errorMessage || 'Sync failed. Please try again.';
      onSyncErrorRef.current?.(new Error(errorMessage));
    }
  }, [status, syncPending]);

  const startSync = () => {
    mutation.mutate();
  };

  return {
    status,
    hasNeverSynced,
    isSyncing,
    isLoadingStatus,
    startSync,
    error: mutation.error,
  };
}
