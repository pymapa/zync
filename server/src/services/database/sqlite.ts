/**
 * SQLite implementation of IDatabase using better-sqlite3
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import type { IDatabase } from './interface';
import type {
  SyncStatus,
  StoredActivity,
  ActivityInput,
  ActivitySearchFilters,
  SyncStatusUpdate,
  DetailedActivityData,
  StoredActivityLap,
  StoredActivitySplitMetric,
  StoredActivityBestEffort,
  StoredActivitySegmentEffort,
  ActivityLapInput,
  ActivitySplitMetricInput,
  ActivityBestEffortInput,
  ActivitySegmentEffortInput,
  ActivityStats,
  ActivityStatsFilters,
  DailyActivityStats,
  ActivityStreaks,
} from './types';
import { runMigrations } from './migrations/runner';
import { encodeGeohash } from './geohash';

// SQLite row types (snake_case from DB)
interface SyncStatusRow {
  user_id: number;
  last_sync_at: number;
  last_activity_id: number | null;
  sync_state: SyncStatus['syncState'];
  total_activities: number;
  error_message: string | null;
  sync_started_at: number | null;
  created_at: number;
  updated_at: number;
}

interface ActivityRow {
  id: number;
  user_id: number;
  name: string;
  type: string;
  distance_meters: number;
  moving_time_seconds: number;
  elapsed_time_seconds: number;
  elevation_gain_meters: number;
  start_date: number;
  start_date_local: string;
  average_speed: number;
  max_speed: number;
  average_heartrate: number | null;
  max_heartrate: number | null;
  calories: number | null;
  description: string | null;
  average_cadence: number | null;
  average_watts: number | null;
  kudos_count: number;
  comment_count: number;
  summary_polyline: string | null;
  start_latlng: string | null;
  end_latlng: string | null;
  start_lat: number | null;
  start_lng: number | null;
  end_lat: number | null;
  end_lng: number | null;
  geohash: string | null;
  device_name: string | null;
  gear_id: string | null;
  max_watts: number | null;
  weighted_average_watts: number | null;
  kilojoules: number | null;
  suffer_score: number | null;
  elev_high: number | null;
  elev_low: number | null;
  photos_json: string | null;
  has_detailed_data: number; // SQLite stores boolean as 0 or 1
  created_at: number;
  updated_at: number;
}

function mapSyncStatusRow(row: SyncStatusRow): SyncStatus {
  return {
    userId: row.user_id,
    lastSyncAt: row.last_sync_at,
    lastActivityId: row.last_activity_id,
    syncState: row.sync_state,
    totalActivities: row.total_activities,
    errorMessage: row.error_message,
    syncStartedAt: row.sync_started_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapActivityRow(row: ActivityRow): StoredActivity {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    type: row.type,
    distanceMeters: row.distance_meters,
    movingTimeSeconds: row.moving_time_seconds,
    elapsedTimeSeconds: row.elapsed_time_seconds,
    elevationGainMeters: row.elevation_gain_meters,
    startDate: row.start_date,
    startDateLocal: row.start_date_local,
    averageSpeed: row.average_speed,
    maxSpeed: row.max_speed,
    averageHeartrate: row.average_heartrate,
    maxHeartrate: row.max_heartrate,
    calories: row.calories,
    description: row.description,
    averageCadence: row.average_cadence,
    averageWatts: row.average_watts,
    kudosCount: row.kudos_count,
    commentCount: row.comment_count,
    summaryPolyline: row.summary_polyline,
    startLatlng: row.start_latlng,
    endLatlng: row.end_latlng,
    startLat: row.start_lat,
    startLng: row.start_lng,
    endLat: row.end_lat,
    endLng: row.end_lng,
    geohash: row.geohash,
    deviceName: row.device_name,
    gearId: row.gear_id,
    maxWatts: row.max_watts,
    weightedAverageWatts: row.weighted_average_watts,
    kilojoules: row.kilojoules,
    sufferScore: row.suffer_score,
    elevHigh: row.elev_high,
    elevLow: row.elev_low,
    photosJson: row.photos_json,
    hasDetailedData: row.has_detailed_data === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SQLiteDatabase implements IDatabase {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dataDir?: string) {
    const dir = dataDir ?? path.join(process.cwd(), 'data');
    this.dbPath = path.join(dir, 'zync.db');

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  init(): void {
    this.db = new Database(this.dbPath);

    // Configure PRAGMAs for performance and safety
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('cache_size = -20000'); // 20MB
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('temp_store = MEMORY');
    this.db.pragma('mmap_size = 268435456'); // 256MB

    // Run migrations
    runMigrations(this.db);
  }

  close(): void {
    if (this.db?.open) {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
      this.db.close();
      this.db = null;
    }
  }

  private getDb(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  // Activity operations

  upsertActivity(activity: ActivityInput): void {
    const db = this.getDb();

    // Extract coordinates - prefer explicit lat/lng, fall back to parsing latlng string
    let startLat = activity.startLat ?? null;
    let startLng = activity.startLng ?? null;
    let endLat = activity.endLat ?? null;
    let endLng = activity.endLng ?? null;

    // Parse from JSON string if not provided directly
    if (startLat === null && activity.startLatlng) {
      try {
        const parsed = JSON.parse(activity.startLatlng);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          startLat = parsed[0];
          startLng = parsed[1];
        }
      } catch {
        // Invalid JSON, ignore
      }
    }
    if (endLat === null && activity.endLatlng) {
      try {
        const parsed = JSON.parse(activity.endLatlng);
        if (Array.isArray(parsed) && parsed.length >= 2) {
          endLat = parsed[0];
          endLng = parsed[1];
        }
      } catch {
        // Invalid JSON, ignore
      }
    }

    // Compute geohash from start coordinates (precision 7 = ~153m)
    const geohash = startLat !== null && startLng !== null
      ? encodeGeohash(startLat, startLng, 7)
      : null;

    const stmt = db.prepare(`
      INSERT INTO activities (
        id, user_id, name, type, distance_meters, moving_time_seconds,
        elapsed_time_seconds, elevation_gain_meters, start_date, start_date_local,
        average_speed, max_speed, average_heartrate, max_heartrate, calories,
        description, average_cadence, average_watts, kudos_count, comment_count,
        summary_polyline, start_latlng, end_latlng,
        start_lat, start_lng, end_lat, end_lng, geohash,
        device_name, gear_id, max_watts, weighted_average_watts, kilojoules,
        suffer_score, elev_high, elev_low, photos_json, has_detailed_data
      ) VALUES (
        @id, @userId, @name, @type, @distanceMeters, @movingTimeSeconds,
        @elapsedTimeSeconds, @elevationGainMeters, @startDate, @startDateLocal,
        @averageSpeed, @maxSpeed, @averageHeartrate, @maxHeartrate, @calories,
        @description, @averageCadence, @averageWatts, @kudosCount, @commentCount,
        @summaryPolyline, @startLatlng, @endLatlng,
        @startLat, @startLng, @endLat, @endLng, @geohash,
        @deviceName, @gearId, @maxWatts, @weightedAverageWatts, @kilojoules,
        @sufferScore, @elevHigh, @elevLow, @photosJson, @hasDetailedData
      )
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        distance_meters = excluded.distance_meters,
        moving_time_seconds = excluded.moving_time_seconds,
        elapsed_time_seconds = excluded.elapsed_time_seconds,
        elevation_gain_meters = excluded.elevation_gain_meters,
        average_speed = excluded.average_speed,
        max_speed = excluded.max_speed,
        average_heartrate = excluded.average_heartrate,
        max_heartrate = excluded.max_heartrate,
        calories = excluded.calories,
        description = excluded.description,
        average_cadence = excluded.average_cadence,
        average_watts = excluded.average_watts,
        kudos_count = excluded.kudos_count,
        comment_count = excluded.comment_count,
        summary_polyline = excluded.summary_polyline,
        start_latlng = excluded.start_latlng,
        end_latlng = excluded.end_latlng,
        start_lat = excluded.start_lat,
        start_lng = excluded.start_lng,
        end_lat = excluded.end_lat,
        end_lng = excluded.end_lng,
        geohash = excluded.geohash,
        device_name = excluded.device_name,
        gear_id = excluded.gear_id,
        max_watts = excluded.max_watts,
        weighted_average_watts = excluded.weighted_average_watts,
        kilojoules = excluded.kilojoules,
        suffer_score = excluded.suffer_score,
        elev_high = excluded.elev_high,
        elev_low = excluded.elev_low,
        photos_json = excluded.photos_json,
        has_detailed_data = excluded.has_detailed_data
    `);

    stmt.run({
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
      hasDetailedData: (activity.hasDetailedData ?? false) ? 1 : 0,
    });
  }

  upsertActivities(activities: ActivityInput[]): void {
    const db = this.getDb();
    const upsertMany = db.transaction((items: ActivityInput[]) => {
      for (const activity of items) {
        this.upsertActivity(activity);
      }
    });
    upsertMany(activities);
  }

  getActivityById(activityId: number, userId: number): StoredActivity | null {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM activities WHERE id = ? AND user_id = ?');
    const row = stmt.get(activityId, userId) as ActivityRow | undefined;
    return row ? mapActivityRow(row) : null;
  }

  searchActivities(filters: ActivitySearchFilters): StoredActivity[] {
    const db = this.getDb();
    const conditions: string[] = ['user_id = ?'];
    const params: unknown[] = [filters.userId];

    if (filters.query?.trim()) {
      conditions.push('id IN (SELECT rowid FROM activities_fts WHERE activities_fts MATCH ?)');
      const sanitizedQuery = filters.query.replace(/['"]/g, '').trim() + '*';
      params.push(sanitizedQuery);
    }

    if (filters.types && filters.types.length > 0) {
      const placeholders = filters.types.map(() => '?').join(', ');
      conditions.push(`type IN (${placeholders})`);
      params.push(...filters.types);
    }

    if (filters.startDateFrom !== undefined) {
      conditions.push('start_date >= ?');
      params.push(filters.startDateFrom);
    }

    if (filters.startDateTo !== undefined) {
      conditions.push('start_date <= ?');
      params.push(filters.startDateTo);
    }

    if (filters.minDistance !== undefined) {
      conditions.push('distance_meters >= ?');
      params.push(filters.minDistance);
    }

    if (filters.maxDistance !== undefined) {
      conditions.push('distance_meters <= ?');
      params.push(filters.maxDistance);
    }

    if (filters.minDuration !== undefined) {
      conditions.push('moving_time_seconds >= ?');
      params.push(filters.minDuration);
    }

    if (filters.maxDuration !== undefined) {
      conditions.push('moving_time_seconds <= ?');
      params.push(filters.maxDuration);
    }

    if (filters.hasHeartRate === true) {
      conditions.push('average_heartrate IS NOT NULL');
    }

    // Location filters
    if (filters.bounds) {
      conditions.push('start_lat >= ? AND start_lat <= ?');
      conditions.push('start_lng >= ? AND start_lng <= ?');
      params.push(filters.bounds.minLat, filters.bounds.maxLat);
      params.push(filters.bounds.minLng, filters.bounds.maxLng);
    }

    if (filters.geohashPrefix) {
      conditions.push('geohash LIKE ?');
      params.push(filters.geohashPrefix + '%');
    }

    const whereClause = conditions.join(' AND ');
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const sql = `
      SELECT * FROM activities
      WHERE ${whereClause}
      ORDER BY start_date DESC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as ActivityRow[];
    return rows.map(mapActivityRow);
  }

  deleteUserActivities(userId: number): void {
    const db = this.getDb();
    const stmt = db.prepare('DELETE FROM activities WHERE user_id = ?');
    stmt.run(userId);
  }

  getUserActivityCount(userId: number): number {
    const db = this.getDb();
    const stmt = db.prepare('SELECT COUNT(*) as count FROM activities WHERE user_id = ?');
    const row = stmt.get(userId) as { count: number };
    return row.count;
  }

  getActivityStats(filters: ActivityStatsFilters): ActivityStats {
    const db = this.getDb();
    const conditions: string[] = ['user_id = ?'];
    const whereParams: unknown[] = [filters.userId];

    if (filters.startDateFrom !== undefined) {
      conditions.push('start_date >= ?');
      whereParams.push(filters.startDateFrom);
    }

    if (filters.startDateTo !== undefined) {
      conditions.push('start_date < ?');
      whereParams.push(filters.startDateTo);
    }

    const whereClause = conditions.join(' AND ');

    // Cycling types
    const cyclingTypes = ['Ride', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'VirtualRide'];
    // Running types
    const runningTypes = ['Run', 'TrailRun', 'VirtualRun'];

    const sql = `
      SELECT
        COALESCE(SUM(moving_time_seconds), 0) as total_moving_time,
        COALESCE(SUM(CASE WHEN type IN (${cyclingTypes.map(() => '?').join(',')}) THEN distance_meters ELSE 0 END), 0) as cycling_distance,
        COALESCE(SUM(CASE WHEN type IN (${runningTypes.map(() => '?').join(',')}) THEN distance_meters ELSE 0 END), 0) as running_distance,
        COALESCE(SUM(calories), 0) as total_calories,
        COUNT(*) as activity_count
      FROM activities
      WHERE ${whereClause}
    `;

    // Parameters must be in SQL order: cycling types, running types, then WHERE params
    const allParams = [...cyclingTypes, ...runningTypes, ...whereParams];
    const stmt = db.prepare(sql);
    const row = stmt.get(...allParams) as {
      total_moving_time: number;
      cycling_distance: number;
      running_distance: number;
      total_calories: number;
      activity_count: number;
    };

    return {
      totalMovingTimeSeconds: row.total_moving_time,
      cyclingDistanceMeters: row.cycling_distance,
      runningDistanceMeters: row.running_distance,
      totalCalories: row.total_calories,
      activityCount: row.activity_count,
    };
  }

  getActivityStreaks(userId: number): ActivityStreaks {
    const db = this.getDb();

    const stmt = db.prepare(`
      SELECT DISTINCT date(start_date, 'unixepoch', 'localtime') as d
      FROM activities WHERE user_id = ? ORDER BY d DESC
    `);
    const rows = stmt.all(userId) as Array<{ d: string }>;

    if (rows.length === 0) {
      return { currentStreak: 0, longestStreak: 0, longestStreakStart: null, longestStreakEnd: null };
    }

    // Parse dates into day-offset values for easy comparison
    const toEpochDay = (dateStr: string): number => {
      const parts = dateStr.split('-').map(Number);
      return Math.floor(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!) / 86400000);
    };

    const today = new Date();
    const todayEpoch = Math.floor(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000
    );

    const epochDays = rows.map(r => toEpochDay(r.d));

    // Current streak: walk backwards from today
    let currentStreak = 0;
    // Allow streak to start from today or yesterday
    const firstDay = epochDays[0]!; // most recent activity date (rows are DESC)
    if (firstDay === todayEpoch || firstDay === todayEpoch - 1) {
      currentStreak = 1;
      for (let i = 1; i < epochDays.length; i++) {
        if (epochDays[i] === epochDays[i - 1]! - 1) {
          currentStreak++;
        } else {
          break;
        }
      }
    }

    // Longest streak: single pass over sorted dates (DESC order)
    let longestStreak = 1;
    let run = 1;
    let bestRunEndIdx = 0; // index of the earliest date in the best run (rows are DESC)
    let runStartIdx = 0; // start index of current run (most recent date)
    for (let i = 1; i < epochDays.length; i++) {
      if (epochDays[i] === epochDays[i - 1]! - 1) {
        run++;
      } else {
        run = 1;
        runStartIdx = i;
      }
      if (run > longestStreak) {
        longestStreak = run;
        bestRunEndIdx = runStartIdx;
      }
    }

    // Since rows are DESC, bestRunEndIdx is the most recent date in the streak
    // and bestRunEndIdx + longestStreak - 1 is the earliest date
    const longestStreakEnd = rows[bestRunEndIdx]?.d ?? null;
    const longestStreakStart = rows[bestRunEndIdx + longestStreak - 1]?.d ?? null;

    return { currentStreak, longestStreak, longestStreakStart, longestStreakEnd };
  }

  getDailyActivityStats(filters: ActivityStatsFilters): DailyActivityStats[] {
    const db = this.getDb();
    const conditions: string[] = ['user_id = ?'];
    const params: unknown[] = [filters.userId];

    if (filters.startDateFrom !== undefined) {
      conditions.push('start_date >= ?');
      params.push(filters.startDateFrom);
    }

    if (filters.startDateTo !== undefined) {
      conditions.push('start_date < ?');
      params.push(filters.startDateTo);
    }

    const whereClause = conditions.join(' AND ');

    const sql = `
      SELECT
        date(start_date, 'unixepoch', 'localtime') as date,
        COALESCE(SUM(moving_time_seconds), 0) as total_moving_time,
        COALESCE(SUM(distance_meters), 0) as total_distance,
        COALESCE(SUM(calories), 0) as total_calories,
        COUNT(*) as activity_count
      FROM activities
      WHERE ${whereClause}
      GROUP BY date(start_date, 'unixepoch', 'localtime')
      ORDER BY date ASC
    `;

    const stmt = db.prepare(sql);
    const rows = stmt.all(...params) as Array<{
      date: string;
      total_moving_time: number;
      total_distance: number;
      total_calories: number;
      activity_count: number;
    }>;

    return rows.map(row => ({
      date: row.date,
      totalMovingTimeSeconds: row.total_moving_time,
      totalDistanceMeters: row.total_distance,
      totalCalories: row.total_calories,
      activityCount: row.activity_count,
    }));
  }

  // Sync status operations

  getSyncStatus(userId: number): SyncStatus | null {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM sync_status WHERE user_id = ?');
    const row = stmt.get(userId) as SyncStatusRow | undefined;
    return row ? mapSyncStatusRow(row) : null;
  }

  createSyncStatus(userId: number): SyncStatus {
    const db = this.getDb();
    const now = Math.floor(Date.now() / 1000);
    const stmt = db.prepare(`
      INSERT INTO sync_status (user_id, last_sync_at, sync_state)
      VALUES (?, ?, 'pending')
    `);
    stmt.run(userId, now);
    return this.getSyncStatus(userId)!;
  }

  updateSyncStatus(userId: number, updates: SyncStatusUpdate): void {
    const db = this.getDb();
    // Build dynamic update to properly handle null values for errorMessage
    const setClauses: string[] = [];
    const params: unknown[] = [];

    if (updates.lastSyncAt !== undefined) {
      setClauses.push('last_sync_at = ?');
      params.push(updates.lastSyncAt);
    }
    if (updates.lastActivityId !== undefined) {
      setClauses.push('last_activity_id = ?');
      params.push(updates.lastActivityId);
    }
    if (updates.syncState !== undefined) {
      setClauses.push('sync_state = ?');
      params.push(updates.syncState);
    }
    if (updates.totalActivities !== undefined) {
      setClauses.push('total_activities = ?');
      params.push(updates.totalActivities);
    }
    if (updates.errorMessage !== undefined) {
      setClauses.push('error_message = ?');
      params.push(updates.errorMessage);
    }
    if (updates.syncStartedAt !== undefined) {
      setClauses.push('sync_started_at = ?');
      params.push(updates.syncStartedAt);
    }

    if (setClauses.length === 0) return;

    params.push(userId);
    const sql = `UPDATE sync_status SET ${setClauses.join(', ')} WHERE user_id = ?`;
    const stmt = db.prepare(sql);
    stmt.run(...params);
  }

  deleteSyncStatus(userId: number): void {
    const db = this.getDb();
    const stmt = db.prepare('DELETE FROM sync_status WHERE user_id = ?');
    stmt.run(userId);
  }

  tryAcquireSyncLock(userId: number, timeoutMs: number = 600000): boolean {
    const db = this.getDb();
    const now = Math.floor(Date.now() / 1000); // Convert to Unix timestamp (seconds)
    const timeoutSeconds = Math.floor(timeoutMs / 1000); // Convert timeout to seconds

    // Use a transaction to ensure atomicity
    const result = db.transaction(() => {
      // First, check current status
      const status = this.getSyncStatus(userId);

      // If no status exists, create one and acquire lock
      if (!status) {
        this.createSyncStatus(userId);
        return true; // Lock acquired (pending state, ready for sync to start)
      }

      // If currently syncing, check if it's stuck (timed out)
      if (status.syncState === 'syncing') {
        const syncStarted = status.syncStartedAt;
        if (syncStarted && (now - syncStarted) > timeoutSeconds) {
          // Sync timed out, reset and acquire
          const stmt = db.prepare(`
            UPDATE sync_status
            SET sync_state = 'error',
                error_message = 'Sync timed out',
                sync_started_at = NULL
            WHERE user_id = ? AND sync_state = 'syncing'
          `);
          stmt.run(userId);
          return true; // Lock acquired after timeout reset
        }
        return false; // Sync in progress, cannot acquire
      }

      // Not syncing, can acquire lock
      return true;
    })();

    return result;
  }

  resetStuckSync(userId: number, timeoutMs: number = 600000): boolean {
    const db = this.getDb();
    const now = Math.floor(Date.now() / 1000); // Convert to Unix timestamp (seconds)
    const timeoutSeconds = Math.floor(timeoutMs / 1000); // Convert timeout to seconds
    const cutoff = now - timeoutSeconds;

    const stmt = db.prepare(`
      UPDATE sync_status
      SET sync_state = 'error',
          error_message = 'Sync timed out after inactivity',
          sync_started_at = NULL
      WHERE user_id = ?
        AND sync_state = 'syncing'
        AND sync_started_at IS NOT NULL
        AND sync_started_at < ?
    `);

    const result = stmt.run(userId, cutoff);
    return result.changes > 0;
  }

  // Detailed activity operations

  upsertDetailedActivity(data: DetailedActivityData): void {
    const db = this.getDb();

    // Use a transaction to ensure all-or-nothing atomicity
    const upsertDetailedTx = db.transaction((detailedData: DetailedActivityData) => {
      // 1. Upsert the main activity with hasDetailedData = true
      const activityWithFlag: ActivityInput = {
        ...detailedData.activity,
        hasDetailedData: true,
      };
      this.upsertActivity(activityWithFlag);

      const activityId = detailedData.activity.id;

      // 2. Delete existing detailed data to ensure clean state
      this.deleteActivityDetails(activityId);

      // 3. Insert laps if provided
      if (detailedData.laps && detailedData.laps.length > 0) {
        const lapStmt = db.prepare(`
          INSERT INTO activity_laps (
            activity_id, lap_index, name, distance_meters, elapsed_time_seconds,
            moving_time_seconds, start_date, total_elevation_gain, average_speed,
            max_speed, average_heartrate, max_heartrate, average_cadence, average_watts
          ) VALUES (
            @activityId, @lapIndex, @name, @distanceMeters, @elapsedTimeSeconds,
            @movingTimeSeconds, @startDate, @totalElevationGain, @averageSpeed,
            @maxSpeed, @averageHeartrate, @maxHeartrate, @averageCadence, @averageWatts
          )
        `);

        for (const lap of detailedData.laps) {
          lapStmt.run({
            activityId: lap.activityId,
            lapIndex: lap.lapIndex,
            name: lap.name,
            distanceMeters: lap.distanceMeters,
            elapsedTimeSeconds: lap.elapsedTimeSeconds,
            movingTimeSeconds: lap.movingTimeSeconds,
            startDate: lap.startDate,
            totalElevationGain: lap.totalElevationGain ?? null,
            averageSpeed: lap.averageSpeed ?? null,
            maxSpeed: lap.maxSpeed ?? null,
            averageHeartrate: lap.averageHeartrate ?? null,
            maxHeartrate: lap.maxHeartrate ?? null,
            averageCadence: lap.averageCadence ?? null,
            averageWatts: lap.averageWatts ?? null,
          });
        }
      }

      // 4. Insert metric splits if provided
      if (detailedData.splitsMetric && detailedData.splitsMetric.length > 0) {
        const splitStmt = db.prepare(`
          INSERT INTO activity_splits_metric (
            activity_id, split, distance_meters, elapsed_time_seconds,
            moving_time_seconds, elevation_difference, average_speed, pace_zone
          ) VALUES (
            @activityId, @split, @distanceMeters, @elapsedTimeSeconds,
            @movingTimeSeconds, @elevationDifference, @averageSpeed, @paceZone
          )
        `);

        for (const split of detailedData.splitsMetric) {
          splitStmt.run({
            activityId: split.activityId,
            split: split.split,
            distanceMeters: split.distanceMeters,
            elapsedTimeSeconds: split.elapsedTimeSeconds,
            movingTimeSeconds: split.movingTimeSeconds,
            elevationDifference: split.elevationDifference ?? null,
            averageSpeed: split.averageSpeed ?? null,
            paceZone: split.paceZone ?? null,
          });
        }
      }

      // 5. Insert best efforts if provided
      if (detailedData.bestEfforts && detailedData.bestEfforts.length > 0) {
        const effortStmt = db.prepare(`
          INSERT INTO activity_best_efforts (
            activity_id, strava_effort_id, name, distance_meters,
            elapsed_time_seconds, moving_time_seconds, start_date, pr_rank
          ) VALUES (
            @activityId, @stravaEffortId, @name, @distanceMeters,
            @elapsedTimeSeconds, @movingTimeSeconds, @startDate, @prRank
          )
        `);

        for (const effort of detailedData.bestEfforts) {
          effortStmt.run({
            activityId: effort.activityId,
            stravaEffortId: effort.stravaEffortId,
            name: effort.name,
            distanceMeters: effort.distanceMeters,
            elapsedTimeSeconds: effort.elapsedTimeSeconds,
            movingTimeSeconds: effort.movingTimeSeconds,
            startDate: effort.startDate,
            prRank: effort.prRank ?? null,
          });
        }
      }

      // 6. Insert segment efforts if provided
      if (detailedData.segmentEfforts && detailedData.segmentEfforts.length > 0) {
        const segmentStmt = db.prepare(`
          INSERT INTO activity_segment_efforts (
            activity_id, strava_effort_id, segment_id, segment_name, distance_meters,
            elapsed_time_seconds, moving_time_seconds, start_date, average_heartrate,
            max_heartrate, average_cadence, average_watts, kom_rank, pr_rank, hidden
          ) VALUES (
            @activityId, @stravaEffortId, @segmentId, @segmentName, @distanceMeters,
            @elapsedTimeSeconds, @movingTimeSeconds, @startDate, @averageHeartrate,
            @maxHeartrate, @averageCadence, @averageWatts, @komRank, @prRank, @hidden
          )
        `);

        for (const segment of detailedData.segmentEfforts) {
          segmentStmt.run({
            activityId: segment.activityId,
            stravaEffortId: segment.stravaEffortId,
            segmentId: segment.segmentId,
            segmentName: segment.segmentName,
            distanceMeters: segment.distanceMeters,
            elapsedTimeSeconds: segment.elapsedTimeSeconds,
            movingTimeSeconds: segment.movingTimeSeconds,
            startDate: segment.startDate,
            averageHeartrate: segment.averageHeartrate ?? null,
            maxHeartrate: segment.maxHeartrate ?? null,
            averageCadence: segment.averageCadence ?? null,
            averageWatts: segment.averageWatts ?? null,
            komRank: segment.komRank ?? null,
            prRank: segment.prRank ?? null,
            hidden: segment.hidden ? 1 : 0,
          });
        }
      }
    });

    upsertDetailedTx(data);
  }

  getActivityLaps(activityId: number): StoredActivityLap[] {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM activity_laps WHERE activity_id = ? ORDER BY lap_index');
    const rows = stmt.all(activityId) as Array<{
      id: number;
      activity_id: number;
      lap_index: number;
      name: string;
      distance_meters: number;
      elapsed_time_seconds: number;
      moving_time_seconds: number;
      start_date: number;
      total_elevation_gain: number | null;
      average_speed: number | null;
      max_speed: number | null;
      average_heartrate: number | null;
      max_heartrate: number | null;
      average_cadence: number | null;
      average_watts: number | null;
      created_at: number;
    }>;

    return rows.map(row => ({
      id: row.id,
      activityId: row.activity_id,
      lapIndex: row.lap_index,
      name: row.name,
      distanceMeters: row.distance_meters,
      elapsedTimeSeconds: row.elapsed_time_seconds,
      movingTimeSeconds: row.moving_time_seconds,
      startDate: row.start_date,
      totalElevationGain: row.total_elevation_gain,
      averageSpeed: row.average_speed,
      maxSpeed: row.max_speed,
      averageHeartrate: row.average_heartrate,
      maxHeartrate: row.max_heartrate,
      averageCadence: row.average_cadence,
      averageWatts: row.average_watts,
      createdAt: row.created_at,
    }));
  }

  getActivitySplitsMetric(activityId: number): StoredActivitySplitMetric[] {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM activity_splits_metric WHERE activity_id = ? ORDER BY split');
    const rows = stmt.all(activityId) as Array<{
      id: number;
      activity_id: number;
      split: number;
      distance_meters: number;
      elapsed_time_seconds: number;
      moving_time_seconds: number;
      elevation_difference: number | null;
      average_speed: number | null;
      pace_zone: number | null;
      created_at: number;
    }>;

    return rows.map(row => ({
      id: row.id,
      activityId: row.activity_id,
      split: row.split,
      distanceMeters: row.distance_meters,
      elapsedTimeSeconds: row.elapsed_time_seconds,
      movingTimeSeconds: row.moving_time_seconds,
      elevationDifference: row.elevation_difference,
      averageSpeed: row.average_speed,
      paceZone: row.pace_zone,
      createdAt: row.created_at,
    }));
  }

  getActivityBestEfforts(activityId: number): StoredActivityBestEffort[] {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM activity_best_efforts WHERE activity_id = ? ORDER BY distance_meters');
    const rows = stmt.all(activityId) as Array<{
      id: number;
      activity_id: number;
      strava_effort_id: number;
      name: string;
      distance_meters: number;
      elapsed_time_seconds: number;
      moving_time_seconds: number;
      start_date: number;
      pr_rank: number | null;
      created_at: number;
    }>;

    return rows.map(row => ({
      id: row.id,
      activityId: row.activity_id,
      stravaEffortId: row.strava_effort_id,
      name: row.name,
      distanceMeters: row.distance_meters,
      elapsedTimeSeconds: row.elapsed_time_seconds,
      movingTimeSeconds: row.moving_time_seconds,
      startDate: row.start_date,
      prRank: row.pr_rank,
      createdAt: row.created_at,
    }));
  }

  getActivitySegmentEfforts(activityId: number): StoredActivitySegmentEffort[] {
    const db = this.getDb();
    const stmt = db.prepare('SELECT * FROM activity_segment_efforts WHERE activity_id = ? ORDER BY start_date');
    const rows = stmt.all(activityId) as Array<{
      id: number;
      activity_id: number;
      strava_effort_id: number;
      segment_id: number;
      segment_name: string;
      distance_meters: number;
      elapsed_time_seconds: number;
      moving_time_seconds: number;
      start_date: number;
      average_heartrate: number | null;
      max_heartrate: number | null;
      average_cadence: number | null;
      average_watts: number | null;
      kom_rank: number | null;
      pr_rank: number | null;
      hidden: number;
      created_at: number;
    }>;

    return rows.map(row => ({
      id: row.id,
      activityId: row.activity_id,
      stravaEffortId: row.strava_effort_id,
      segmentId: row.segment_id,
      segmentName: row.segment_name,
      distanceMeters: row.distance_meters,
      elapsedTimeSeconds: row.elapsed_time_seconds,
      movingTimeSeconds: row.moving_time_seconds,
      startDate: row.start_date,
      averageHeartrate: row.average_heartrate,
      maxHeartrate: row.max_heartrate,
      averageCadence: row.average_cadence,
      averageWatts: row.average_watts,
      komRank: row.kom_rank,
      prRank: row.pr_rank,
      hidden: row.hidden === 1,
      createdAt: row.created_at,
    }));
  }

  deleteActivityDetails(activityId: number): void {
    const db = this.getDb();

    // Delete in transaction for atomicity
    const deleteTx = db.transaction((id: number) => {
      db.prepare('DELETE FROM activity_laps WHERE activity_id = ?').run(id);
      db.prepare('DELETE FROM activity_splits_metric WHERE activity_id = ?').run(id);
      db.prepare('DELETE FROM activity_best_efforts WHERE activity_id = ?').run(id);
      db.prepare('DELETE FROM activity_segment_efforts WHERE activity_id = ?').run(id);
    });

    deleteTx(activityId);
  }

}
