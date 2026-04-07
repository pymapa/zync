/**
 * PostgreSQL implementation of IDatabase
 */

import { Pool, PoolClient, types } from 'pg';
import type { IDatabase } from './interface';

// PostgreSQL BIGINT (OID 20) returns as string by default because JS Number
// can't represent all 64-bit integers. Our IDs fit in Number, so parse them.
types.setTypeParser(20, (val) => parseInt(val, 10));
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
  ActivityStats,
  ActivityStatsFilters,
  DailyActivityStats,
  ActivityStreaks,
} from './types';
import { runMigrations } from './pg-migrations/runner';
import { encodeGeohash } from './geohash';

// Row types (snake_case from DB)
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
  has_detailed_data: boolean;
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
    hasDetailedData: row.has_detailed_data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Parse coordinates from latlng JSON string if not provided directly
 */
function parseCoordinates(activity: ActivityInput): {
  startLat: number | null;
  startLng: number | null;
  endLat: number | null;
  endLng: number | null;
  geohash: string | null;
} {
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

  return { startLat, startLng, endLat, endLng, geohash };
}

export class PostgresDatabase implements IDatabase {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async init(): Promise<void> {
    await runMigrations(this.pool);
  }

  async close(): Promise<void> {
    // Pool is managed externally (shared with session store)
  }

  // Activity operations

  async upsertActivity(activity: ActivityInput): Promise<void> {
    const client = await this.pool.connect();
    try {
      await this.upsertActivityWithClient(client, activity);
    } finally {
      client.release();
    }
  }

  async upsertActivities(activities: ActivityInput[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const activity of activities) {
        await this.upsertActivityWithClient(client, activity);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getActivityById(activityId: number, userId: number): Promise<StoredActivity | null> {
    const { rows } = await this.pool.query<ActivityRow>(
      'SELECT * FROM activities WHERE id = $1 AND user_id = $2',
      [activityId, userId]
    );
    return rows[0] ? mapActivityRow(rows[0]) : null;
  }

  async searchActivities(filters: ActivitySearchFilters): Promise<StoredActivity[]> {
    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [filters.userId];
    let paramIdx = 2;

    if (filters.query?.trim()) {
      const sanitized = filters.query.replace(/['"]/g, '').trim();
      conditions.push(`search_vector @@ to_tsquery('simple', $${paramIdx})`);
      params.push(sanitized.split(/\s+/).map(t => t + ':*').join(' & '));
      paramIdx++;
    }

    if (filters.types && filters.types.length > 0) {
      const placeholders = filters.types.map(() => `$${paramIdx++}`).join(', ');
      conditions.push(`type IN (${placeholders})`);
      params.push(...filters.types);
    }

    if (filters.startDateFrom !== undefined) {
      conditions.push(`start_date >= $${paramIdx++}`);
      params.push(filters.startDateFrom);
    }
    if (filters.startDateTo !== undefined) {
      conditions.push(`start_date <= $${paramIdx++}`);
      params.push(filters.startDateTo);
    }
    if (filters.minDistance !== undefined) {
      conditions.push(`distance_meters >= $${paramIdx++}`);
      params.push(filters.minDistance);
    }
    if (filters.maxDistance !== undefined) {
      conditions.push(`distance_meters <= $${paramIdx++}`);
      params.push(filters.maxDistance);
    }
    if (filters.minDuration !== undefined) {
      conditions.push(`moving_time_seconds >= $${paramIdx++}`);
      params.push(filters.minDuration);
    }
    if (filters.maxDuration !== undefined) {
      conditions.push(`moving_time_seconds <= $${paramIdx++}`);
      params.push(filters.maxDuration);
    }
    if (filters.hasHeartRate === true) {
      conditions.push('average_heartrate IS NOT NULL');
    }
    if (filters.bounds) {
      conditions.push(`start_lat >= $${paramIdx} AND start_lat <= $${paramIdx + 1}`);
      conditions.push(`start_lng >= $${paramIdx + 2} AND start_lng <= $${paramIdx + 3}`);
      params.push(filters.bounds.minLat, filters.bounds.maxLat, filters.bounds.minLng, filters.bounds.maxLng);
      paramIdx += 4;
    }
    if (filters.geohashPrefix) {
      conditions.push(`geohash LIKE $${paramIdx++}`);
      params.push(filters.geohashPrefix + '%');
    }

    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;

    const sql = `
      SELECT * FROM activities
      WHERE ${conditions.join(' AND ')}
      ORDER BY start_date DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
    params.push(limit, offset);

    const { rows } = await this.pool.query<ActivityRow>(sql, params);
    return rows.map(mapActivityRow);
  }

  async deleteUserActivities(userId: number): Promise<void> {
    await this.pool.query('DELETE FROM activities WHERE user_id = $1', [userId]);
  }

  async getUserActivityCount(userId: number): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM activities WHERE user_id = $1',
      [userId]
    );
    return parseInt(rows[0]!.count, 10);
  }

  async getActivityStats(filters: ActivityStatsFilters): Promise<ActivityStats> {
    const conditions: string[] = ['user_id = $1'];
    const whereParams: unknown[] = [filters.userId];
    let paramIdx = 2;

    if (filters.startDateFrom !== undefined) {
      conditions.push(`start_date >= $${paramIdx++}`);
      whereParams.push(filters.startDateFrom);
    }
    if (filters.startDateTo !== undefined) {
      conditions.push(`start_date < $${paramIdx++}`);
      whereParams.push(filters.startDateTo);
    }

    const cyclingTypes = ['Ride', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'VirtualRide'];
    const runningTypes = ['Run', 'TrailRun', 'VirtualRun'];

    const cyclingPlaceholders = cyclingTypes.map(() => `$${paramIdx++}`).join(',');
    const runningPlaceholders = runningTypes.map(() => `$${paramIdx++}`).join(',');

    const sql = `
      SELECT
        COALESCE(SUM(moving_time_seconds), 0) as total_moving_time,
        COALESCE(SUM(CASE WHEN type IN (${cyclingPlaceholders}) THEN distance_meters ELSE 0 END), 0) as cycling_distance,
        COALESCE(SUM(CASE WHEN type IN (${runningPlaceholders}) THEN distance_meters ELSE 0 END), 0) as running_distance,
        COALESCE(SUM(calories), 0) as total_calories,
        COUNT(*) as activity_count
      FROM activities
      WHERE ${conditions.join(' AND ')}
    `;

    const allParams = [...whereParams, ...cyclingTypes, ...runningTypes];
    const { rows } = await this.pool.query(sql, allParams);
    const row = rows[0]!;

    return {
      totalMovingTimeSeconds: Number(row.total_moving_time),
      cyclingDistanceMeters: Number(row.cycling_distance),
      runningDistanceMeters: Number(row.running_distance),
      totalCalories: Number(row.total_calories),
      activityCount: Number(row.activity_count),
    };
  }

  async getActivityStreaks(userId: number): Promise<ActivityStreaks> {
    const { rows } = await this.pool.query<{ d: string }>(
      `SELECT DISTINCT to_char(to_timestamp(start_date) AT TIME ZONE 'UTC', 'YYYY-MM-DD') as d
       FROM activities WHERE user_id = $1 ORDER BY d DESC`,
      [userId]
    );

    if (rows.length === 0) {
      return { currentStreak: 0, longestStreak: 0, longestStreakStart: null, longestStreakEnd: null };
    }

    const toEpochDay = (dateStr: string): number => {
      const parts = dateStr.split('-').map(Number);
      return Math.floor(Date.UTC(parts[0]!, parts[1]! - 1, parts[2]!) / 86400000);
    };

    const today = new Date();
    const todayEpoch = Math.floor(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000
    );

    const epochDays = rows.map(r => toEpochDay(r.d));

    let currentStreak = 0;
    const firstDay = epochDays[0]!;
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

    let longestStreak = 1;
    let run = 1;
    let bestRunEndIdx = 0;
    let runStartIdx = 0;
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

    const longestStreakEnd = rows[bestRunEndIdx]?.d ?? null;
    const longestStreakStart = rows[bestRunEndIdx + longestStreak - 1]?.d ?? null;

    return { currentStreak, longestStreak, longestStreakStart, longestStreakEnd };
  }

  async getDailyActivityStats(filters: ActivityStatsFilters): Promise<DailyActivityStats[]> {
    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [filters.userId];
    let paramIdx = 2;

    if (filters.startDateFrom !== undefined) {
      conditions.push(`start_date >= $${paramIdx++}`);
      params.push(filters.startDateFrom);
    }
    if (filters.startDateTo !== undefined) {
      conditions.push(`start_date < $${paramIdx++}`);
      params.push(filters.startDateTo);
    }

    const sql = `
      SELECT
        to_char(to_timestamp(start_date) AT TIME ZONE 'UTC', 'YYYY-MM-DD') as date,
        COALESCE(SUM(moving_time_seconds), 0) as total_moving_time,
        COALESCE(SUM(distance_meters), 0) as total_distance,
        COALESCE(SUM(calories), 0) as total_calories,
        COUNT(*) as activity_count
      FROM activities
      WHERE ${conditions.join(' AND ')}
      GROUP BY to_char(to_timestamp(start_date) AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      ORDER BY date ASC
    `;

    const { rows } = await this.pool.query(sql, params);
    return rows.map(row => ({
      date: row.date,
      totalMovingTimeSeconds: Number(row.total_moving_time),
      totalDistanceMeters: Number(row.total_distance),
      totalCalories: Number(row.total_calories),
      activityCount: Number(row.activity_count),
    }));
  }

  // Sync status operations

  async getSyncStatus(userId: number): Promise<SyncStatus | null> {
    const { rows } = await this.pool.query<SyncStatusRow>(
      'SELECT * FROM sync_status WHERE user_id = $1',
      [userId]
    );
    return rows[0] ? mapSyncStatusRow(rows[0]) : null;
  }

  async createSyncStatus(userId: number): Promise<SyncStatus> {
    const now = Math.floor(Date.now() / 1000);
    await this.pool.query(
      `INSERT INTO sync_status (user_id, last_sync_at, sync_state) VALUES ($1, $2, 'pending')`,
      [userId, now]
    );
    return (await this.getSyncStatus(userId))!;
  }

  async updateSyncStatus(userId: number, updates: SyncStatusUpdate): Promise<void> {
    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (updates.lastSyncAt !== undefined) {
      setClauses.push(`last_sync_at = $${paramIdx++}`);
      params.push(updates.lastSyncAt);
    }
    if (updates.lastActivityId !== undefined) {
      setClauses.push(`last_activity_id = $${paramIdx++}`);
      params.push(updates.lastActivityId);
    }
    if (updates.syncState !== undefined) {
      setClauses.push(`sync_state = $${paramIdx++}`);
      params.push(updates.syncState);
    }
    if (updates.totalActivities !== undefined) {
      setClauses.push(`total_activities = $${paramIdx++}`);
      params.push(updates.totalActivities);
    }
    if (updates.errorMessage !== undefined) {
      setClauses.push(`error_message = $${paramIdx++}`);
      params.push(updates.errorMessage);
    }
    if (updates.syncStartedAt !== undefined) {
      setClauses.push(`sync_started_at = $${paramIdx++}`);
      params.push(updates.syncStartedAt);
    }

    if (setClauses.length === 0) return;

    params.push(userId);
    const sql = `UPDATE sync_status SET ${setClauses.join(', ')} WHERE user_id = $${paramIdx}`;
    await this.pool.query(sql, params);
  }

  async deleteSyncStatus(userId: number): Promise<void> {
    await this.pool.query('DELETE FROM sync_status WHERE user_id = $1', [userId]);
  }

  async tryAcquireSyncLock(userId: number, timeoutMs: number = 600000): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const timeoutSeconds = Math.floor(timeoutMs / 1000);

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query<SyncStatusRow>(
        'SELECT * FROM sync_status WHERE user_id = $1 FOR UPDATE',
        [userId]
      );

      if (rows.length === 0) {
        await client.query(
          `INSERT INTO sync_status (user_id, last_sync_at, sync_state) VALUES ($1, $2, 'pending')`,
          [userId, now]
        );
        await client.query('COMMIT');
        return true;
      }

      const status = rows[0]!;

      if (status.sync_state === 'syncing') {
        const syncStarted = status.sync_started_at;
        if (syncStarted && (now - syncStarted) > timeoutSeconds) {
          await client.query(
            `UPDATE sync_status SET sync_state = 'error', error_message = 'Sync timed out', sync_started_at = NULL
             WHERE user_id = $1 AND sync_state = 'syncing'`,
            [userId]
          );
          await client.query('COMMIT');
          return true;
        }
        await client.query('COMMIT');
        return false;
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async resetStuckSync(userId: number, timeoutMs: number = 600000): Promise<boolean> {
    const now = Math.floor(Date.now() / 1000);
    const timeoutSeconds = Math.floor(timeoutMs / 1000);
    const cutoff = now - timeoutSeconds;

    const result = await this.pool.query(
      `UPDATE sync_status
       SET sync_state = 'error', error_message = 'Sync timed out after inactivity', sync_started_at = NULL
       WHERE user_id = $1 AND sync_state = 'syncing' AND sync_started_at IS NOT NULL AND sync_started_at < $2`,
      [userId, cutoff]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // Detailed activity operations

  async upsertDetailedActivity(data: DetailedActivityData): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Upsert main activity with hasDetailedData = true
      const activityWithFlag: ActivityInput = { ...data.activity, hasDetailedData: true };
      await this.upsertActivityWithClient(client, activityWithFlag);

      const activityId = data.activity.id;

      // Delete existing detailed data
      await client.query('DELETE FROM activity_laps WHERE activity_id = $1', [activityId]);
      await client.query('DELETE FROM activity_splits_metric WHERE activity_id = $1', [activityId]);
      await client.query('DELETE FROM activity_best_efforts WHERE activity_id = $1', [activityId]);
      await client.query('DELETE FROM activity_segment_efforts WHERE activity_id = $1', [activityId]);

      // Insert laps
      if (data.laps && data.laps.length > 0) {
        for (const lap of data.laps) {
          await client.query(
            `INSERT INTO activity_laps (
              activity_id, lap_index, name, distance_meters, elapsed_time_seconds,
              moving_time_seconds, start_date, total_elevation_gain, average_speed,
              max_speed, average_heartrate, max_heartrate, average_cadence, average_watts
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              lap.activityId, lap.lapIndex, lap.name, lap.distanceMeters,
              lap.elapsedTimeSeconds, lap.movingTimeSeconds, lap.startDate,
              lap.totalElevationGain ?? null, lap.averageSpeed ?? null,
              lap.maxSpeed ?? null, lap.averageHeartrate ?? null,
              lap.maxHeartrate ?? null, lap.averageCadence ?? null, lap.averageWatts ?? null,
            ]
          );
        }
      }

      // Insert splits
      if (data.splitsMetric && data.splitsMetric.length > 0) {
        for (const split of data.splitsMetric) {
          await client.query(
            `INSERT INTO activity_splits_metric (
              activity_id, split, distance_meters, elapsed_time_seconds,
              moving_time_seconds, elevation_difference, average_speed, pace_zone
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              split.activityId, split.split, split.distanceMeters,
              split.elapsedTimeSeconds, split.movingTimeSeconds,
              split.elevationDifference ?? null, split.averageSpeed ?? null,
              split.paceZone ?? null,
            ]
          );
        }
      }

      // Insert best efforts
      if (data.bestEfforts && data.bestEfforts.length > 0) {
        for (const effort of data.bestEfforts) {
          await client.query(
            `INSERT INTO activity_best_efforts (
              activity_id, strava_effort_id, name, distance_meters,
              elapsed_time_seconds, moving_time_seconds, start_date, pr_rank
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              effort.activityId, effort.stravaEffortId, effort.name, effort.distanceMeters,
              effort.elapsedTimeSeconds, effort.movingTimeSeconds, effort.startDate,
              effort.prRank ?? null,
            ]
          );
        }
      }

      // Insert segment efforts
      if (data.segmentEfforts && data.segmentEfforts.length > 0) {
        for (const segment of data.segmentEfforts) {
          await client.query(
            `INSERT INTO activity_segment_efforts (
              activity_id, strava_effort_id, segment_id, segment_name, distance_meters,
              elapsed_time_seconds, moving_time_seconds, start_date, average_heartrate,
              max_heartrate, average_cadence, average_watts, kom_rank, pr_rank, hidden
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
              segment.activityId, segment.stravaEffortId, segment.segmentId,
              segment.segmentName, segment.distanceMeters,
              segment.elapsedTimeSeconds, segment.movingTimeSeconds, segment.startDate,
              segment.averageHeartrate ?? null, segment.maxHeartrate ?? null,
              segment.averageCadence ?? null, segment.averageWatts ?? null,
              segment.komRank ?? null, segment.prRank ?? null,
              segment.hidden ?? false,
            ]
          );
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async upsertActivityWithClient(client: PoolClient, activity: ActivityInput): Promise<void> {
    const coords = parseCoordinates(activity);
    await client.query(
      `INSERT INTO activities (
        id, user_id, name, type, distance_meters, moving_time_seconds,
        elapsed_time_seconds, elevation_gain_meters, start_date, start_date_local,
        average_speed, max_speed, average_heartrate, max_heartrate, calories,
        description, average_cadence, average_watts, kudos_count, comment_count,
        summary_polyline, start_latlng, end_latlng,
        start_lat, start_lng, end_lat, end_lng, geohash,
        device_name, gear_id, max_watts, weighted_average_watts, kilojoules,
        suffer_score, elev_high, elev_low, photos_json, has_detailed_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
        $31, $32, $33, $34, $35, $36, $37, $38
      )
      ON CONFLICT(id) DO UPDATE SET
        name = EXCLUDED.name, type = EXCLUDED.type,
        distance_meters = EXCLUDED.distance_meters,
        moving_time_seconds = EXCLUDED.moving_time_seconds,
        elapsed_time_seconds = EXCLUDED.elapsed_time_seconds,
        elevation_gain_meters = EXCLUDED.elevation_gain_meters,
        average_speed = EXCLUDED.average_speed, max_speed = EXCLUDED.max_speed,
        average_heartrate = EXCLUDED.average_heartrate, max_heartrate = EXCLUDED.max_heartrate,
        calories = EXCLUDED.calories, description = EXCLUDED.description,
        average_cadence = EXCLUDED.average_cadence, average_watts = EXCLUDED.average_watts,
        kudos_count = EXCLUDED.kudos_count, comment_count = EXCLUDED.comment_count,
        summary_polyline = EXCLUDED.summary_polyline,
        start_latlng = EXCLUDED.start_latlng, end_latlng = EXCLUDED.end_latlng,
        start_lat = EXCLUDED.start_lat, start_lng = EXCLUDED.start_lng,
        end_lat = EXCLUDED.end_lat, end_lng = EXCLUDED.end_lng, geohash = EXCLUDED.geohash,
        device_name = EXCLUDED.device_name, gear_id = EXCLUDED.gear_id,
        max_watts = EXCLUDED.max_watts, weighted_average_watts = EXCLUDED.weighted_average_watts,
        kilojoules = EXCLUDED.kilojoules, suffer_score = EXCLUDED.suffer_score,
        elev_high = EXCLUDED.elev_high, elev_low = EXCLUDED.elev_low,
        photos_json = EXCLUDED.photos_json, has_detailed_data = EXCLUDED.has_detailed_data`,
      [
        activity.id, activity.userId, activity.name, activity.type,
        activity.distanceMeters, activity.movingTimeSeconds,
        activity.elapsedTimeSeconds, activity.elevationGainMeters,
        activity.startDate, activity.startDateLocal,
        activity.averageSpeed, activity.maxSpeed,
        activity.averageHeartrate ?? null, activity.maxHeartrate ?? null,
        activity.calories ?? null, activity.description ?? null,
        activity.averageCadence ?? null, activity.averageWatts ?? null,
        activity.kudosCount ?? 0, activity.commentCount ?? 0,
        activity.summaryPolyline ?? null,
        activity.startLatlng ?? null, activity.endLatlng ?? null,
        coords.startLat, coords.startLng, coords.endLat, coords.endLng, coords.geohash,
        activity.deviceName ?? null, activity.gearId ?? null,
        activity.maxWatts ?? null, activity.weightedAverageWatts ?? null,
        activity.kilojoules ?? null, activity.sufferScore ?? null,
        activity.elevHigh ?? null, activity.elevLow ?? null,
        activity.photosJson ?? null, activity.hasDetailedData ?? false,
      ]
    );
  }

  async getActivityLaps(activityId: number): Promise<StoredActivityLap[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM activity_laps WHERE activity_id = $1 ORDER BY lap_index',
      [activityId]
    );
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

  async getActivitySplitsMetric(activityId: number): Promise<StoredActivitySplitMetric[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM activity_splits_metric WHERE activity_id = $1 ORDER BY split',
      [activityId]
    );
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

  async getActivityBestEfforts(activityId: number): Promise<StoredActivityBestEffort[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM activity_best_efforts WHERE activity_id = $1 ORDER BY distance_meters',
      [activityId]
    );
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

  async getActivitySegmentEfforts(activityId: number): Promise<StoredActivitySegmentEffort[]> {
    const { rows } = await this.pool.query(
      'SELECT * FROM activity_segment_efforts WHERE activity_id = $1 ORDER BY start_date',
      [activityId]
    );
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
      hidden: row.hidden,
      createdAt: row.created_at,
    }));
  }

  async deleteActivityDetails(activityId: number): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM activity_laps WHERE activity_id = $1', [activityId]);
      await client.query('DELETE FROM activity_splits_metric WHERE activity_id = $1', [activityId]);
      await client.query('DELETE FROM activity_best_efforts WHERE activity_id = $1', [activityId]);
      await client.query('DELETE FROM activity_segment_efforts WHERE activity_id = $1', [activityId]);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
