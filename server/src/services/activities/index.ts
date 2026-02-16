/**
 * Activities service
 * Handles fetching activities from local database or Strava API
 */

import { LRUCache } from '../cache/cache';
import { StravaClient } from '../strava/client';
import { getActivities as getStravaActivities, getActivityById as getStravaActivityById, getActivityStreams as getStravaActivityStreams } from '../strava/activities';
import { getDatabase } from '../database';
import { mapStravaActivity, mapStravaDetailedActivity } from '../../types/mappers';
import { mapStravaDetailedActivityToDetailedData } from './mappers';
import { logger } from '../../utils/logger';
import type { Activity, DetailedActivity } from '../../types';
import type { StoredActivity, DailyActivityStats } from '../database/types';

export type DataSource = 'local' | 'strava' | 'auto';
export type StatsPeriod = 'week' | 'last_week' | 'month' | 'year' | 'last_year' | 'all';

export interface ListActivitiesParams {
  userId: number;
  accessToken: string;
  page?: number;
  perPage?: number;
  before?: number;
  after?: number;
  source?: DataSource;
  // Filters
  search?: string;
  types?: string[];
  minDistance?: number;
  maxDistance?: number;
  minDuration?: number;
  maxDuration?: number;
  hasHeartRate?: boolean;
}

export interface ListActivitiesResult {
  activities: Activity[];
  page: number;
  perPage: number;
  hasMore: boolean;
  totalCount?: number;
  source: 'local' | 'strava';
  cached: boolean;
}

export interface GetActivityParams {
  userId: number;
  accessToken: string;
  activityId: number;
  source?: DataSource;
}

export interface GetActivityResult {
  activity: DetailedActivity;
  source: 'local' | 'strava';
  cached: boolean;
}

export interface GetStatsParams {
  userId: number;
  period: StatsPeriod;
}

export interface GetStatsResult {
  period: StatsPeriod;
  totalMovingTimeSeconds: number;
  cyclingDistanceMeters: number;
  runningDistanceMeters: number;
  totalCalories: number;
  activityCount: number;
  currentStreak: number;
  longestStreak: number;
  longestStreakStart: string | null;
  longestStreakEnd: string | null;
}

export interface DailyStatsItem {
  date: string;
  hours: number;
  distanceKm: number;
  calories: number;
  activityCount: number;
}

export interface GetDailyStatsResult {
  period: StatsPeriod;
  data: DailyStatsItem[];
}

export interface GetStreamsParams {
  userId: number;
  accessToken: string;
  activityId: number;
}

export interface GetStreamsResult {
  time: number[];
  heartrate: number[] | null;
  velocity: number[] | null;
  altitude: number[] | null;
  power: number[] | null;
}

/**
 * Map stored activity from database to Activity type
 */
function mapStoredActivityToActivity(stored: StoredActivity): Activity {
  return {
    id: stored.id,
    name: stored.name,
    type: stored.type as Activity['type'],
    distanceMeters: stored.distanceMeters,
    movingTimeSeconds: stored.movingTimeSeconds,
    elapsedTimeSeconds: stored.elapsedTimeSeconds,
    elevationGainMeters: stored.elevationGainMeters,
    startDate: new Date(stored.startDate * 1000).toISOString(), // Convert Unix timestamp (seconds) to milliseconds
    startDateLocal: stored.startDateLocal,
    averageSpeed: stored.averageSpeed,
    maxSpeed: stored.maxSpeed,
    averageHeartRate: stored.averageHeartrate,
    maxHeartRate: stored.maxHeartrate,
    kudosCount: stored.kudosCount,
    commentCount: stored.commentCount,
  };
}

/**
 * Map stored activity from database to DetailedActivity type
 */
function mapStoredActivityToDetailedActivity(stored: StoredActivity): DetailedActivity {
  const baseActivity = mapStoredActivityToActivity(stored);

  let startLatLng: [number, number] | null = null;
  let endLatLng: [number, number] | null = null;

  if (stored.startLatlng) {
    try {
      const parsed = JSON.parse(stored.startLatlng);
      if (Array.isArray(parsed) && parsed.length === 2) {
        startLatLng = [parsed[0], parsed[1]];
      }
    } catch {
      // Invalid JSON, use null
    }
  }

  if (stored.endLatlng) {
    try {
      const parsed = JSON.parse(stored.endLatlng);
      if (Array.isArray(parsed) && parsed.length === 2) {
        endLatLng = [parsed[0], parsed[1]];
      }
    } catch {
      // Invalid JSON, use null
    }
  }

  // Retrieve detailed data from database if available
  let laps = null;
  let splitsMetric = null;

  if (stored.hasDetailedData) {
    const db = getDatabase();

    // Fetch laps
    const storedLaps = db.getActivityLaps(stored.id);
    if (storedLaps.length > 0) {
      laps = storedLaps.map(lap => ({
        lapIndex: lap.lapIndex,
        name: lap.name,
        distanceMeters: lap.distanceMeters,
        elapsedTimeSeconds: lap.elapsedTimeSeconds,
        movingTimeSeconds: lap.movingTimeSeconds,
        startDate: new Date(lap.startDate * 1000).toISOString(), // Convert Unix timestamp to ISO string
        totalElevationGain: lap.totalElevationGain,
        averageSpeed: lap.averageSpeed,
        maxSpeed: lap.maxSpeed,
        averageHeartRate: lap.averageHeartrate,
        maxHeartRate: lap.maxHeartrate,
      }));
    }

    // Fetch metric splits
    const storedSplits = db.getActivitySplitsMetric(stored.id);
    if (storedSplits.length > 0) {
      splitsMetric = storedSplits.map(split => ({
        split: split.split,
        distanceMeters: split.distanceMeters,
        elapsedTimeSeconds: split.elapsedTimeSeconds,
        movingTimeSeconds: split.movingTimeSeconds,
        elevationDifference: split.elevationDifference,
        averageSpeed: split.averageSpeed,
        paceZone: split.paceZone,
      }));
    }
  }

  return {
    ...baseActivity,
    description: stored.description,
    calories: stored.calories,
    averageCadence: stored.averageCadence,
    averageWatts: stored.averageWatts,
    maxWatts: stored.maxWatts,
    weightedAverageWatts: stored.weightedAverageWatts,
    sufferScore: stored.sufferScore,
    startLatLng,
    endLatLng,
    map: stored.summaryPolyline
      ? { polyline: null, summaryPolyline: stored.summaryPolyline }
      : null,
    laps,
    splitsMetric,
  };
}

export class ActivitiesService {
  constructor(private cache: LRUCache<unknown>) {}

  /**
   * List activities with pagination
   * Default: tries local first, falls back to Strava if empty
   */
  async listActivities(params: ListActivitiesParams): Promise<ListActivitiesResult> {
    const {
      userId,
      accessToken,
      page = 1,
      perPage = 30,
      before,
      after,
      source = 'auto',
      search,
      types,
      minDistance,
      maxDistance,
      minDuration,
      maxDuration,
      hasHeartRate,
    } = params;

    const filterParams = { search, types, minDistance, maxDistance, minDuration, maxDuration, hasHeartRate };

    if (source === 'strava') {
      // Strava API doesn't support filtering, so we ignore filter params
      return this.listFromStrava({ userId, accessToken, page, perPage, before, after });
    }

    if (source === 'local') {
      return this.listFromLocal({ userId, page, perPage, before, after, ...filterParams });
    }

    // Auto: try local first, fallback to Strava if empty on page 1 and no filters
    const localResult = this.listFromLocal({ userId, page, perPage, before, after, ...filterParams });

    const hasFilters = search || (types && types.length > 0) || minDistance !== undefined ||
                      maxDistance !== undefined || minDuration !== undefined ||
                      maxDuration !== undefined || hasHeartRate !== undefined;

    if (localResult.activities.length === 0 && page === 1 && !hasFilters) {
      logger.info('No local activities found, falling back to Strava', { userId });
      return this.listFromStrava({ userId, accessToken, page, perPage, before, after });
    }

    return localResult;
  }

  /**
   * Get a single activity by ID
   * Default: tries local first, falls back to Strava if not found
   */
  async getActivity(params: GetActivityParams): Promise<GetActivityResult | null> {
    const { userId, accessToken, activityId, source = 'auto' } = params;

    if (source === 'strava') {
      return this.getFromStrava({ userId, accessToken, activityId });
    }

    if (source === 'local') {
      return this.getFromLocal({ userId, activityId });
    }

    // Auto: try local first, fallback to Strava if not found
    const localResult = this.getFromLocal({ userId, activityId });

    if (!localResult) {
      logger.info('Activity not found locally, falling back to Strava', { userId, activityId });
      return this.getFromStrava({ userId, accessToken, activityId });
    }

    return localResult;
  }

  /**
   * Get aggregated activity stats for a time period
   */
  getStats(params: GetStatsParams): GetStatsResult {
    const { userId, period } = params;
    const { startDateFrom, startDateTo } = this.calculateDateRange(period);

    const db = getDatabase();
    const stats = db.getActivityStats({
      userId,
      startDateFrom,
      startDateTo,
    });
    const streaks = db.getActivityStreaks(userId);

    return {
      period,
      totalMovingTimeSeconds: stats.totalMovingTimeSeconds,
      cyclingDistanceMeters: stats.cyclingDistanceMeters,
      runningDistanceMeters: stats.runningDistanceMeters,
      totalCalories: stats.totalCalories,
      activityCount: stats.activityCount,
      currentStreak: streaks.currentStreak,
      longestStreak: streaks.longestStreak,
      longestStreakStart: streaks.longestStreakStart,
      longestStreakEnd: streaks.longestStreakEnd,
    };
  }

  /**
   * Get daily activity stats for charts.
   * week/last_week/month return one bar per day.
   * year/all aggregate into monthly buckets so the chart stays readable.
   */
  getDailyStats(params: GetStatsParams): GetDailyStatsResult {
    const { userId, period } = params;
    const { startDateFrom, startDateTo } = this.calculateDateRange(period);

    const db = getDatabase();
    const dailyStats = db.getDailyActivityStats({
      userId,
      startDateFrom,
      startDateTo,
    });

    // year: monthly buckets (up to 12).  all: yearly buckets.
    if (period === 'year') {
      return { period, data: this.aggregateByMonth(dailyStats) };
    }
    if (period === 'all') {
      return { period, data: this.aggregateByYear(dailyStats) };
    }

    // Create a map of existing data
    const statsMap = new Map(
      dailyStats.map(day => [
        day.date,
        {
          hours: day.totalMovingTimeSeconds / 3600,
          distanceKm: day.totalDistanceMeters / 1000,
          calories: day.totalCalories,
          activityCount: day.activityCount,
        },
      ])
    );

    // Generate all dates in the range
    const allDates = this.generateDateRange(period, startDateFrom, startDateTo);

    // Fill in data for all dates (0 for missing days)
    const data: DailyStatsItem[] = allDates.map(date => ({
      date,
      hours: statsMap.get(date)?.hours ?? 0,
      distanceKm: statsMap.get(date)?.distanceKm ?? 0,
      calories: statsMap.get(date)?.calories ?? 0,
      activityCount: statsMap.get(date)?.activityCount ?? 0,
    }));

    return {
      period,
      data,
    };
  }

  /**
   * Get stream data for an activity from Strava
   */
  async getStreams(params: GetStreamsParams): Promise<GetStreamsResult> {
    const { userId, accessToken, activityId } = params;

    const cacheKey = LRUCache.scopedKey(userId, `streams:${activityId}`);
    const cached = this.cache.get(cacheKey) as GetStreamsResult | undefined;
    if (cached) {
      logger.debug('Streams retrieved from cache', { userId, activityId });
      return cached;
    }

    const client = new StravaClient(accessToken);
    const streams = await getStravaActivityStreams(client, activityId);

    const result: GetStreamsResult = {
      time: streams.time?.data ?? [],
      heartrate: streams.heartrate?.data ?? null,
      velocity: streams.velocity_smooth?.data ?? null,
      altitude: streams.altitude?.data ?? null,
      power: streams.watts?.data ?? null,
    };

    this.cache.set(cacheKey, result, 600);

    logger.info('Activity streams fetched from Strava', {
      userId,
      activityId,
      availableStreams: Object.keys(streams),
    });

    return result;
  }

  /**
   * Generate all dates in a period range
   */
  private generateDateRange(
    period: StatsPeriod,
    startDateFrom?: number,
    startDateTo?: number
  ): string[] {
    const dates: string[] = [];
    const now = new Date();
    now.setHours(23, 59, 59, 999); // End of today

    // For 'all' period without bounds, show last 30 days
    if (period === 'all' && !startDateFrom) {
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(now.getDate() - 29);
      thirtyDaysAgo.setHours(0, 0, 0, 0);
      startDateFrom = Math.floor(thirtyDaysAgo.getTime() / 1000);
    }

    if (!startDateFrom) {
      return dates;
    }

    const startDate = new Date(startDateFrom * 1000);
    startDate.setHours(0, 0, 0, 0);

    // endDate is exclusive when startDateTo is specified, inclusive (today) otherwise
    const endDate = startDateTo ? new Date(startDateTo * 1000) : now;
    const isExclusive = !!startDateTo;

    const current = new Date(startDate);
    while (isExclusive ? current < endDate : current <= endDate) {
      // Format as YYYY-MM-DD using local time
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Collapse per-day rows into one row per calendar month.
   * Each bucket's date is set to the 1st so the frontend can label it "Jan", "Feb", etc.
   */
  private aggregateByMonth(dailyStats: DailyActivityStats[]): DailyStatsItem[] {
    const buckets = new Map<string, DailyStatsItem>();

    for (const day of dailyStats) {
      const monthKey = day.date.slice(0, 7); // "YYYY-MM"
      const existing = buckets.get(monthKey);

      if (existing) {
        existing.hours        += day.totalMovingTimeSeconds / 3600;
        existing.distanceKm   += day.totalDistanceMeters   / 1000;
        existing.calories     += day.totalCalories;
        existing.activityCount += day.activityCount;
      } else {
        buckets.set(monthKey, {
          date:          monthKey + '-01',
          hours:         day.totalMovingTimeSeconds / 3600,
          distanceKm:    day.totalDistanceMeters   / 1000,
          calories:      day.totalCalories,
          activityCount: day.activityCount,
        });
      }
    }

    return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Collapse per-day rows into one row per calendar year.
   * Each bucket's date is set to Jan 1 so the frontend can label it "2024", "2025", etc.
   */
  private aggregateByYear(dailyStats: DailyActivityStats[]): DailyStatsItem[] {
    const buckets = new Map<string, DailyStatsItem>();

    for (const day of dailyStats) {
      const yearKey = day.date.slice(0, 4); // "YYYY"
      const existing = buckets.get(yearKey);

      if (existing) {
        existing.hours        += day.totalMovingTimeSeconds / 3600;
        existing.distanceKm   += day.totalDistanceMeters   / 1000;
        existing.calories     += day.totalCalories;
        existing.activityCount += day.activityCount;
      } else {
        buckets.set(yearKey, {
          date:          yearKey + '-01-01',
          hours:         day.totalMovingTimeSeconds / 3600,
          distanceKm:    day.totalDistanceMeters   / 1000,
          calories:      day.totalCalories,
          activityCount: day.activityCount,
        });
      }
    }

    return Array.from(buckets.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Calculate date range for a stats period
   */
  private calculateDateRange(period: StatsPeriod): {
    startDateFrom?: number;
    startDateTo?: number;
  } {
    const now = new Date();

    switch (period) {
      case 'week': {
        // Monday of current week
        const dayOfWeek = now.getDay();
        const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const monday = new Date(now);
        monday.setDate(now.getDate() - diffToMonday);
        monday.setHours(0, 0, 0, 0);
        return { startDateFrom: Math.floor(monday.getTime() / 1000) };
      }
      case 'last_week': {
        // Monday of last week to Monday of this week
        const dayOfWeek = now.getDay();
        const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const thisMonday = new Date(now);
        thisMonday.setDate(now.getDate() - diffToMonday);
        thisMonday.setHours(0, 0, 0, 0);
        const lastMonday = new Date(thisMonday);
        lastMonday.setDate(thisMonday.getDate() - 7);
        return {
          startDateFrom: Math.floor(lastMonday.getTime() / 1000),
          startDateTo: Math.floor(thisMonday.getTime() / 1000),
        };
      }
      case 'month': {
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return { startDateFrom: Math.floor(firstOfMonth.getTime() / 1000) };
      }
      case 'year': {
        const firstOfYear = new Date(now.getFullYear(), 0, 1);
        return { startDateFrom: Math.floor(firstOfYear.getTime() / 1000) };
      }
      case 'last_year': {
        const firstOfLastYear = new Date(now.getFullYear() - 1, 0, 1);
        const firstOfThisYear = new Date(now.getFullYear(), 0, 1);
        return {
          startDateFrom: Math.floor(firstOfLastYear.getTime() / 1000),
          startDateTo: Math.floor(firstOfThisYear.getTime() / 1000),
        };
      }
      case 'all':
      default:
        return {};
    }
  }

  // Private methods

  private listFromLocal(params: {
    userId: number;
    page: number;
    perPage: number;
    before?: number;
    after?: number;
    search?: string;
    types?: string[];
    minDistance?: number;
    maxDistance?: number;
    minDuration?: number;
    maxDuration?: number;
    hasHeartRate?: boolean;
  }): ListActivitiesResult {
    const { userId, page, perPage, before, after, search, types, minDistance, maxDistance, minDuration, maxDuration, hasHeartRate } = params;

    const db = getDatabase();
    const filters = {
      userId,
      query: search,
      types,
      startDateFrom: after,
      startDateTo: before,
      minDistance,
      maxDistance,
      minDuration,
      maxDuration,
      hasHeartRate,
      limit: perPage,
      offset: (page - 1) * perPage,
    };

    const storedActivities = db.searchActivities(filters);
    const activities = storedActivities.map(mapStoredActivityToActivity);

    // Get total count for pagination (only when no filters for accurate count)
    const hasFilters = before !== undefined || after !== undefined ||
                      search !== undefined || (types && types.length > 0) ||
                      minDistance !== undefined || maxDistance !== undefined ||
                      minDuration !== undefined || maxDuration !== undefined ||
                      hasHeartRate !== undefined;
    const totalCount = !hasFilters ? db.getUserActivityCount(userId) : undefined;

    logger.debug('Activities fetched from database', {
      userId,
      count: activities.length,
      page,
      totalCount,
    });

    return {
      activities,
      page,
      perPage,
      hasMore: activities.length === perPage,
      totalCount,
      source: 'local',
      cached: false,
    };
  }

  private async listFromStrava(params: {
    userId: number;
    accessToken: string;
    page: number;
    perPage: number;
    before?: number;
    after?: number;
  }): Promise<ListActivitiesResult> {
    const { userId, accessToken, page, perPage, before, after } = params;

    const cacheKey = LRUCache.scopedKey(
      userId,
      `activities:${page}:${perPage}:${before || 'none'}:${after || 'none'}`
    );

    const cached = this.cache.get(cacheKey) as Activity[] | undefined;
    if (cached) {
      logger.debug('Activities retrieved from cache', { userId, page });
      return {
        activities: cached,
        page,
        perPage,
        hasMore: cached.length === perPage,
        source: 'strava',
        cached: true,
      };
    }

    const client = new StravaClient(accessToken);
    const stravaActivities = await getStravaActivities(client, { page, perPage, before, after });
    const activities = stravaActivities.map(mapStravaActivity);

    this.cache.set(cacheKey, activities, 300);

    logger.info('Activities fetched from Strava', {
      userId,
      count: activities.length,
      page,
    });

    return {
      activities,
      page,
      perPage,
      hasMore: activities.length === perPage,
      source: 'strava',
      cached: false,
    };
  }

  private getFromLocal(params: {
    userId: number;
    activityId: number;
  }): GetActivityResult | null {
    const { userId, activityId } = params;

    const db = getDatabase();
    const storedActivity = db.getActivityById(activityId, userId);

    if (!storedActivity) {
      return null;
    }

    // Check if we have detailed data - if not, return null to trigger Strava fetch
    if (!storedActivity.hasDetailedData) {
      logger.debug('Activity found in DB but missing detailed data', {
        userId,
        activityId,
      });
      return null;
    }

    const activity = mapStoredActivityToDetailedActivity(storedActivity);

    logger.debug('Activity with detailed data fetched from database', {
      userId,
      activityId,
      name: activity.name,
    });

    return { activity, source: 'local', cached: false };
  }

  private async getFromStrava(params: {
    userId: number;
    accessToken: string;
    activityId: number;
  }): Promise<GetActivityResult> {
    const { userId, accessToken, activityId } = params;

    const cacheKey = LRUCache.scopedKey(userId, `activity:${activityId}`);

    const cached = this.cache.get(cacheKey) as DetailedActivity | undefined;
    if (cached) {
      logger.debug('Activity retrieved from cache', { userId, activityId });
      return { activity: cached, source: 'strava', cached: true };
    }

    const client = new StravaClient(accessToken);
    const stravaActivity = await getStravaActivityById(client, activityId);
    const activity = mapStravaDetailedActivity(stravaActivity);

    // Store detailed activity data in database for future use
    try {
      const db = getDatabase();
      const detailedData = mapStravaDetailedActivityToDetailedData(stravaActivity, userId);
      db.upsertDetailedActivity(detailedData);

      logger.debug('Detailed activity data stored in database', {
        userId,
        activityId,
        hasLaps: !!detailedData.laps?.length,
        hasSplits: !!detailedData.splitsMetric?.length,
      });
    } catch (error) {
      // Log error but don't fail the request - caching is a nice-to-have
      logger.error('Failed to store detailed activity in database', {
        userId,
        activityId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    this.cache.set(cacheKey, activity, 600);

    logger.info('Activity fetched from Strava and cached', {
      userId,
      activityId,
      name: activity.name,
    });

    return { activity, source: 'strava', cached: false };
  }
}
