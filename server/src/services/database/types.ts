/**
 * Database types and interfaces
 *
 * IMPORTANT: All timestamp fields use Unix timestamps in SECONDS (not milliseconds).
 * This follows SQLite's strftime('%s', 'now') convention.
 * Convert JavaScript Date.now() by dividing by 1000: Math.floor(Date.now() / 1000)
 */

export interface SyncStatus {
  userId: number;
  lastSyncAt: number; // Unix timestamp in seconds
  lastActivityId: number | null;
  syncState: 'pending' | 'syncing' | 'completed' | 'error';
  totalActivities: number;
  errorMessage: string | null;
  syncStartedAt: number | null; // Unix timestamp in seconds
  createdAt: number; // Unix timestamp in seconds
  updatedAt: number; // Unix timestamp in seconds
}

export interface StoredActivity {
  id: number;
  userId: number;
  name: string;
  type: string;
  distanceMeters: number;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  elevationGainMeters: number;
  startDate: number; // Unix timestamp in seconds
  startDateLocal: string;
  averageSpeed: number;
  maxSpeed: number;
  averageHeartrate: number | null;
  maxHeartrate: number | null;
  calories: number | null;
  description: string | null;
  averageCadence: number | null;
  averageWatts: number | null;
  kudosCount: number;
  commentCount: number;
  summaryPolyline: string | null;
  startLatlng: string | null;
  endLatlng: string | null;
  // Separate location columns for efficient queries
  startLat: number | null;
  startLng: number | null;
  endLat: number | null;
  endLng: number | null;
  geohash: string | null;
  // Detailed activity fields
  deviceName: string | null;
  gearId: string | null;
  maxWatts: number | null;
  weightedAverageWatts: number | null;
  kilojoules: number | null;
  sufferScore: number | null;
  elevHigh: number | null;
  elevLow: number | null;
  photosJson: string | null; // JSON-encoded PhotosSummary
  hasDetailedData: boolean; // Whether full detailed data has been fetched from Strava
  createdAt: number; // Unix timestamp in seconds
  updatedAt: number; // Unix timestamp in seconds
}

export interface ActivityInput {
  id: number;
  userId: number;
  name: string;
  type: string;
  distanceMeters: number;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  elevationGainMeters: number;
  startDate: number; // Unix timestamp in seconds
  startDateLocal: string;
  averageSpeed: number;
  maxSpeed: number;
  averageHeartrate?: number | null;
  maxHeartrate?: number | null;
  calories?: number | null;
  description?: string | null;
  averageCadence?: number | null;
  averageWatts?: number | null;
  kudosCount?: number;
  commentCount?: number;
  summaryPolyline?: string | null;
  startLatlng?: string | null;
  endLatlng?: string | null;
  // Location can be provided as separate coords (preferred) or parsed from latlng strings
  startLat?: number | null;
  startLng?: number | null;
  endLat?: number | null;
  endLng?: number | null;
  // Detailed activity fields
  deviceName?: string | null;
  gearId?: string | null;
  maxWatts?: number | null;
  weightedAverageWatts?: number | null;
  kilojoules?: number | null;
  sufferScore?: number | null;
  elevHigh?: number | null;
  elevLow?: number | null;
  photosJson?: string | null;
  hasDetailedData?: boolean; // Whether this is full detailed data from Strava
}

export interface ActivitySearchFilters {
  userId: number;
  query?: string;
  types?: string[];
  startDateFrom?: number; // Unix timestamp in seconds
  startDateTo?: number; // Unix timestamp in seconds
  minDistance?: number;
  maxDistance?: number;
  minDuration?: number;
  maxDuration?: number;
  hasHeartRate?: boolean;
  // Location filters
  bounds?: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  };
  geohashPrefix?: string;
  limit?: number;
  offset?: number;
}

export interface SyncStatusUpdate {
  lastSyncAt?: number; // Unix timestamp in seconds
  lastActivityId?: number;
  syncState?: SyncStatus['syncState'];
  totalActivities?: number;
  errorMessage?: string | null;
  syncStartedAt?: number | null; // Unix timestamp in seconds
}

// Detailed activity related data types

export interface StoredActivityLap {
  id: number;
  activityId: number;
  lapIndex: number;
  name: string;
  distanceMeters: number;
  elapsedTimeSeconds: number;
  movingTimeSeconds: number;
  startDate: number; // Unix timestamp in seconds
  totalElevationGain: number | null;
  averageSpeed: number | null;
  maxSpeed: number | null;
  averageHeartrate: number | null;
  maxHeartrate: number | null;
  averageCadence: number | null;
  averageWatts: number | null;
  createdAt: number; // Unix timestamp in seconds
}

export interface ActivityLapInput {
  activityId: number;
  lapIndex: number;
  name: string;
  distanceMeters: number;
  elapsedTimeSeconds: number;
  movingTimeSeconds: number;
  startDate: number;
  totalElevationGain?: number | null;
  averageSpeed?: number | null;
  maxSpeed?: number | null;
  averageHeartrate?: number | null;
  maxHeartrate?: number | null;
  averageCadence?: number | null;
  averageWatts?: number | null;
}

export interface StoredActivitySplitMetric {
  id: number;
  activityId: number;
  split: number;
  distanceMeters: number;
  elapsedTimeSeconds: number;
  movingTimeSeconds: number;
  elevationDifference: number | null;
  averageSpeed: number | null;
  paceZone: number | null;
  createdAt: number; // Unix timestamp in seconds
}

export interface ActivitySplitMetricInput {
  activityId: number;
  split: number;
  distanceMeters: number;
  elapsedTimeSeconds: number;
  movingTimeSeconds: number;
  elevationDifference?: number | null;
  averageSpeed?: number | null;
  paceZone?: number | null;
}

export interface StoredActivityBestEffort {
  id: number;
  activityId: number;
  stravaEffortId: number;
  name: string;
  distanceMeters: number;
  elapsedTimeSeconds: number;
  movingTimeSeconds: number;
  startDate: number; // Unix timestamp in seconds
  prRank: number | null;
  createdAt: number; // Unix timestamp in seconds
}

export interface ActivityBestEffortInput {
  activityId: number;
  stravaEffortId: number;
  name: string;
  distanceMeters: number;
  elapsedTimeSeconds: number;
  movingTimeSeconds: number;
  startDate: number;
  prRank?: number | null;
}

export interface StoredActivitySegmentEffort {
  id: number;
  activityId: number;
  stravaEffortId: number;
  segmentId: number;
  segmentName: string;
  distanceMeters: number;
  elapsedTimeSeconds: number;
  movingTimeSeconds: number;
  startDate: number; // Unix timestamp in seconds
  averageHeartrate: number | null;
  maxHeartrate: number | null;
  averageCadence: number | null;
  averageWatts: number | null;
  komRank: number | null;
  prRank: number | null;
  hidden: boolean;
  createdAt: number; // Unix timestamp in seconds
}

export interface ActivitySegmentEffortInput {
  activityId: number;
  stravaEffortId: number;
  segmentId: number;
  segmentName: string;
  distanceMeters: number;
  elapsedTimeSeconds: number;
  movingTimeSeconds: number;
  startDate: number;
  averageHeartrate?: number | null;
  maxHeartrate?: number | null;
  averageCadence?: number | null;
  averageWatts?: number | null;
  komRank?: number | null;
  prRank?: number | null;
  hidden?: boolean;
}

/**
 * Complete detailed activity data including all nested structures
 */
export interface DetailedActivityData {
  activity: ActivityInput;
  laps?: ActivityLapInput[];
  splitsMetric?: ActivitySplitMetricInput[];
  bestEfforts?: ActivityBestEffortInput[];
  segmentEfforts?: ActivitySegmentEffortInput[];
}

/**
 * Aggregated activity stats for a time period
 */
export interface ActivityStats {
  totalMovingTimeSeconds: number;
  cyclingDistanceMeters: number;
  runningDistanceMeters: number;
  totalCalories: number;
  activityCount: number;
}

export interface ActivityStatsFilters {
  userId: number;
  startDateFrom?: number; // Unix timestamp in seconds
  startDateTo?: number; // Unix timestamp in seconds
}

/**
 * Activity streak data (consecutive days with activities)
 */
export interface ActivityStreaks {
  currentStreak: number;
  longestStreak: number;
  longestStreakStart: string | null; // YYYY-MM-DD
  longestStreakEnd: string | null; // YYYY-MM-DD
}

/**
 * Daily activity stats for charts
 */
export interface DailyActivityStats {
  date: string; // YYYY-MM-DD
  totalMovingTimeSeconds: number;
  totalDistanceMeters: number;
  totalCalories: number;
  activityCount: number;
}
