import { useState, useEffect, useRef, useCallback } from 'react';
import { useSync } from '../../hooks/useSync';
import { Button, Badge } from '../ui';
import { RefreshIcon } from '../icons';

interface SyncButtonProps {
  /**
   * Callback fired after sync completes successfully
   */
  readonly onSyncComplete?: () => void;
}

export function SyncButton({ onSyncComplete }: SyncButtonProps) {
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const messageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (messageTimeoutRef.current) {
        clearTimeout(messageTimeoutRef.current);
      }
    };
  }, []);

  const clearMessageAfterDelay = useCallback(() => {
    if (messageTimeoutRef.current) {
      clearTimeout(messageTimeoutRef.current);
    }
    messageTimeoutRef.current = setTimeout(() => setMessage(null), 5000);
  }, []);

  const { isSyncing, startSync, status } = useSync({
    onSyncComplete: () => {
      setMessage({
        type: 'success',
        text: 'Activities synced',
      });
      onSyncComplete?.();
      clearMessageAfterDelay();
    },
    onSyncError: (error) => {
      setMessage({
        type: 'error',
        text: error.message || 'Sync failed',
      });
      clearMessageAfterDelay();
    },
  });

  const handleSync = () => {
    setMessage(null);
    startSync();
  };

  const getSyncStatusText = () => {
    if (!status) {
      return null;
    }

    if (status.syncState === 'syncing') {
      return `Syncing ${status.totalActivities} activities…`;
    }

    if (status.lastSyncAt && status.syncState === 'completed') {
      const lastSyncDate = new Date(status.lastSyncAt * 1000);
      const now = new Date();
      const diffMs = now.getTime() - lastSyncDate.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) {
        return 'Synced just now';
      }
      if (diffMins < 60) {
        return `Synced ${diffMins}m ago`;
      }
      if (diffHours < 24) {
        return `Synced ${diffHours}h ago`;
      }
      return `Synced ${diffDays}d ago`;
    }

    return null;
  };

  const statusText = getSyncStatusText();

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        onClick={handleSync}
        isLoading={isSyncing}
        size="sm"
        shape="pill"
        icon={<RefreshIcon className="w-4 h-4" />}
      >
        {isSyncing ? 'Syncing…' : 'Sync'}
      </Button>

      {statusText && !message && (
        <p className="text-xs text-text-muted">{statusText}</p>
      )}

      {message && (
        <Badge variant={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </Badge>
      )}
    </div>
  );
}
