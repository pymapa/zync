import { apiClient } from './client';

export interface StartSyncResponse {
  message: string;
  syncStarted: boolean;
  userId: number;
  estimatedTimeSeconds?: number;
}

export interface SyncStatus {
  lastSyncAt: number | null;
  lastActivityId: number | null;
  syncState: 'pending' | 'syncing' | 'completed' | 'error';
  totalActivities: number;
  errorMessage: string | null;
  syncStartedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface SyncStatusResponse {
  userId: number;
  syncStatus: SyncStatus | null;
  hasNeverSynced: boolean;
}

export interface StartSyncOptions {
  pageSize?: number;
  maxPages?: number;
}

export const syncApi = {
  /**
   * Trigger sync of activities from Strava to local database.
   * Returns 202 Accepted - sync runs asynchronously.
   */
  async startSync(options?: StartSyncOptions): Promise<StartSyncResponse> {
    const response = await apiClient.post<StartSyncResponse>('/sync', options);
    return response.data;
  },

  /**
   * Get current sync status for authenticated user.
   */
  async getSyncStatus(): Promise<SyncStatusResponse> {
    const response = await apiClient.get<SyncStatusResponse>('/sync/status');
    return response.data;
  },
};
