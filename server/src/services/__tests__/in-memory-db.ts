/**
 * In-memory IDatabase implementation for tests
 * Supports the full IDatabase interface without requiring a real database connection
 */

import { encodeGeohash } from '../database/geohash';
import type { IDatabase } from '../database/interface';
import type {
  ActivityInput,
  ActivitySearchFilters,
  ActivityStats,
  ActivityStatsFilters,
  ActivityStreaks,
  DailyActivityStats,
  DetailedActivityData,
  StoredActivity,
  StoredActivityBestEffort,
  StoredActivityLap,
  StoredActivitySegmentEffort,
  StoredActivitySplitMetric,
  SyncStatus,
  SyncStatusUpdate,
} from '../database/types';

export class InMemoryDatabase implements IDatabase {
  private activities = new Map<number, StoredActivity>();
  private syncStatuses = new Map<number, SyncStatus>();

  async init(): Promise<void> {}

  async close(): Promise<void> {}

  private activityInputToStored(activity: ActivityInput): StoredActivity {
    const now = Math.floor(Date.now() / 1000);

    // Resolve coordinates: prefer explicit fields, fall back to parsing latlng strings
    let startLat = activity.startLat ?? null;
    let startLng = activity.startLng ?? null;
    let endLat = activity.endLat ?? null;
    let endLng = activity.endLng ?? null;

    if (startLat === null && activity.startLatlng) {
      try {
        const parsed = JSON.parse(activity.startLatlng);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          startLat = parsed[0];
          startLng = parsed[1];
        }
      } catch { /* ignore */ }
    }
    if (endLat === null && activity.endLatlng) {
      try {
        const parsed = JSON.parse(activity.endLatlng);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          endLat = parsed[0];
          endLng = parsed[1];
        }
      } catch { /* ignore */ }
    }

    const geohash = startLat !== null && startLng !== null
      ? encodeGeohash(startLat, startLng, 7)
      : null;

    return {
      id: activity.id,
      userId: activity.userId,
      name: activity.name,
      type: activity.type,
      distanceMeters: activity.distanceMeters,
      movingTimeSeconds: activity.movingTimeSeconds,
      elapsedTimeSeconds: activity.elapsedTimeSeconds,
      elevationGainMeters: activity.elevationGainMeters,
      startDate: activity.startDate,
      startDateLocal: activity.startDateLocal,
      averageSpeed: activity.averageSpeed,
      maxSpeed: activity.maxSpeed,
      averageHeartrate: activity.averageHeartrate ?? null,
      maxHeartrate: activity.maxHeartrate ?? null,
      calories: activity.calories ?? null,
      description: activity.description ?? null,
      averageCadence: activity.averageCadence ?? null,
      averageWatts: activity.averageWatts ?? null,
      kudosCount: activity.kudosCount ?? 0,
      commentCount: activity.commentCount ?? 0,
      summaryPolyline: activity.summaryPolyline ?? null,
      startLatlng: activity.startLatlng ?? null,
      endLatlng: activity.endLatlng ?? null,
      startLat,
      startLng,
      endLat,
      endLng,
      geohash,
      deviceName: activity.deviceName ?? null,
      gearId: activity.gearId ?? null,
      maxWatts: activity.maxWatts ?? null,
      weightedAverageWatts: activity.weightedAverageWatts ?? null,
      kilojoules: activity.kilojoules ?? null,
      sufferScore: activity.sufferScore ?? null,
      elevHigh: activity.elevHigh ?? null,
      elevLow: activity.elevLow ?? null,
      photosJson: activity.photosJson ?? null,
      hasDetailedData: activity.hasDetailedData ?? false,
      createdAt: this.activities.get(activity.id)?.createdAt ?? now,
      updatedAt: now,
    };
  }

  async upsertActivity(activity: ActivityInput): Promise<void> {
    this.activities.set(activity.id, this.activityInputToStored(activity));
  }

  async upsertActivities(activities: ActivityInput[]): Promise<void> {
    for (const activity of activities) {
      await this.upsertActivity(activity);
    }
  }

  async getActivityById(activityId: number, userId: number): Promise<StoredActivity | null> {
    const activity = this.activities.get(activityId);
    if (!activity || activity.userId !== userId) return null;
    return activity;
  }

  async searchActivities(filters: ActivitySearchFilters): Promise<StoredActivity[]> {
    let results = Array.from(this.activities.values())
      .filter(a => a.userId === filters.userId);

    if (filters.types && filters.types.length > 0) {
      results = results.filter(a => filters.types!.includes(a.type));
    }
    if (filters.startDateFrom !== undefined) {
      results = results.filter(a => a.startDate >= filters.startDateFrom!);
    }
    if (filters.startDateTo !== undefined) {
      results = results.filter(a => a.startDate < filters.startDateTo!);
    }
    if (filters.minDistance !== undefined) {
      results = results.filter(a => a.distanceMeters >= filters.minDistance!);
    }
    if (filters.maxDistance !== undefined) {
      results = results.filter(a => a.distanceMeters <= filters.maxDistance!);
    }
    if (filters.hasHeartRate !== undefined) {
      results = results.filter(a =>
        filters.hasHeartRate ? a.averageHeartrate !== null : a.averageHeartrate === null
      );
    }

    // Sort by startDate descending (newest first)
    results.sort((a, b) => b.startDate - a.startDate);

    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? results.length;
    return results.slice(offset, offset + limit);
  }

  async deleteUserActivities(userId: number): Promise<void> {
    for (const [id, activity] of this.activities.entries()) {
      if (activity.userId === userId) {
        this.activities.delete(id);
      }
    }
  }

  async getUserActivityCount(userId: number): Promise<number> {
    let count = 0;
    for (const activity of this.activities.values()) {
      if (activity.userId === userId) count++;
    }
    return count;
  }

  async getActivityStats(filters: ActivityStatsFilters): Promise<ActivityStats> {
    let activities = Array.from(this.activities.values())
      .filter(a => a.userId === filters.userId);

    if (filters.startDateFrom !== undefined) {
      activities = activities.filter(a => a.startDate >= filters.startDateFrom!);
    }
    if (filters.startDateTo !== undefined) {
      activities = activities.filter(a => a.startDate < filters.startDateTo!);
    }

    return {
      totalMovingTimeSeconds: activities.reduce((sum, a) => sum + a.movingTimeSeconds, 0),
      cyclingDistanceMeters: activities.filter(a => a.type === 'Ride' || a.type === 'VirtualRide')
        .reduce((sum, a) => sum + a.distanceMeters, 0),
      runningDistanceMeters: activities.filter(a => a.type === 'Run' || a.type === 'VirtualRun')
        .reduce((sum, a) => sum + a.distanceMeters, 0),
      totalCalories: activities.reduce((sum, a) => sum + (a.calories ?? 0), 0),
      activityCount: activities.length,
    };
  }

  async getActivityStreaks(_userId: number): Promise<ActivityStreaks> {
    return {
      currentStreak: 0,
      longestStreak: 0,
      longestStreakStart: null,
      longestStreakEnd: null,
    };
  }

  async getDailyActivityStats(_filters: ActivityStatsFilters): Promise<DailyActivityStats[]> {
    return [];
  }

  async upsertDetailedActivity(data: DetailedActivityData): Promise<void> {
    await this.upsertActivity({ ...data.activity, hasDetailedData: true });
  }

  async getActivityLaps(_activityId: number): Promise<StoredActivityLap[]> {
    return [];
  }

  async getActivitySplitsMetric(_activityId: number): Promise<StoredActivitySplitMetric[]> {
    return [];
  }

  async getActivityBestEfforts(_activityId: number): Promise<StoredActivityBestEffort[]> {
    return [];
  }

  async getActivitySegmentEfforts(_activityId: number): Promise<StoredActivitySegmentEffort[]> {
    return [];
  }

  async deleteActivityDetails(_activityId: number): Promise<void> {}

  async getSyncStatus(userId: number): Promise<SyncStatus | null> {
    return this.syncStatuses.get(userId) ?? null;
  }

  async createSyncStatus(userId: number): Promise<SyncStatus> {
    const now = Math.floor(Date.now() / 1000);
    const status: SyncStatus = {
      userId,
      lastSyncAt: now,
      lastActivityId: null,
      syncState: 'pending',
      totalActivities: 0,
      errorMessage: null,
      syncStartedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.syncStatuses.set(userId, status);
    return status;
  }

  async updateSyncStatus(userId: number, updates: SyncStatusUpdate): Promise<void> {
    const status = this.syncStatuses.get(userId);
    if (!status) return;

    const now = Math.floor(Date.now() / 1000);
    if (updates.lastSyncAt !== undefined) status.lastSyncAt = updates.lastSyncAt;
    if (updates.lastActivityId !== undefined) status.lastActivityId = updates.lastActivityId;
    if (updates.syncState !== undefined) status.syncState = updates.syncState;
    if (updates.totalActivities !== undefined) status.totalActivities = updates.totalActivities;
    if (updates.errorMessage !== undefined) status.errorMessage = updates.errorMessage;
    if (updates.syncStartedAt !== undefined) status.syncStartedAt = updates.syncStartedAt;
    status.updatedAt = now;
  }

  async deleteSyncStatus(userId: number): Promise<void> {
    this.syncStatuses.delete(userId);
  }

  async tryAcquireSyncLock(userId: number, timeoutMs: number = 600000): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const timeoutSeconds = Math.floor(timeoutMs / 1000);

    const status = this.syncStatuses.get(userId);

    if (!status) {
      // No status yet — create one in pending state
      await this.createSyncStatus(userId);
      return true;
    }

    if (status.syncState === 'syncing') {
      const syncStarted = status.syncStartedAt;
      if (syncStarted && (now - syncStarted) > timeoutSeconds) {
        // Timed out — reset to error and allow new sync
        status.syncState = 'error';
        status.errorMessage = 'Sync timed out';
        status.syncStartedAt = null;
        status.updatedAt = now;
        return true;
      }
      return false;
    }

    return true;
  }

  async resetStuckSync(userId: number, timeoutMs: number = 600000): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const timeoutSeconds = Math.floor(timeoutMs / 1000);

    const status = this.syncStatuses.get(userId);
    if (
      status &&
      status.syncState === 'syncing' &&
      status.syncStartedAt !== null &&
      (now - status.syncStartedAt) > timeoutSeconds
    ) {
      status.syncState = 'error';
      status.errorMessage = 'Sync timed out after inactivity';
      status.syncStartedAt = null;
      status.updatedAt = now;
      return true;
    }

    return false;
  }
}
