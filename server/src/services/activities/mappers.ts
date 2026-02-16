/**
 * Mappers for converting Strava detailed activities to database format
 */

import type { StravaDetailedActivity } from '../strava/types';
import type {
  ActivityInput,
  DetailedActivityData,
  ActivityLapInput,
  ActivitySplitMetricInput,
  ActivityBestEffortInput,
  ActivitySegmentEffortInput,
} from '../database/types';

/**
 * Convert Strava start_latlng array to JSON string for database storage
 */
function serializeLatLng(latlng: [number, number] | null): string | null {
  if (!latlng || !Array.isArray(latlng) || latlng.length !== 2) {
    return null;
  }
  return JSON.stringify(latlng);
}

/**
 * Convert Strava detailed activity to ActivityInput for database storage
 */
export function mapStravaDetailedActivityToActivityInput(
  strava: StravaDetailedActivity,
  userId: number
): ActivityInput {
  const startLatlng = serializeLatLng(strava.start_latlng);
  const endLatlng = serializeLatLng(strava.end_latlng);

  // Parse start coordinates for separate columns
  const startLat = strava.start_latlng?.[0] ?? null;
  const startLng = strava.start_latlng?.[1] ?? null;
  const endLat = strava.end_latlng?.[0] ?? null;
  const endLng = strava.end_latlng?.[1] ?? null;

  // Convert ISO date string to Unix timestamp (seconds)
  const startDate = Math.floor(new Date(strava.start_date).getTime() / 1000);

  // Serialize photos if present
  const photosJson = strava.photos ? JSON.stringify(strava.photos) : null;

  return {
    id: strava.id,
    userId,
    name: strava.name,
    type: strava.sport_type,
    distanceMeters: strava.distance,
    movingTimeSeconds: strava.moving_time,
    elapsedTimeSeconds: strava.elapsed_time,
    elevationGainMeters: strava.total_elevation_gain,
    startDate,
    startDateLocal: strava.start_date_local,
    averageSpeed: strava.average_speed,
    maxSpeed: strava.max_speed,
    averageHeartrate: strava.average_heartrate ?? null,
    maxHeartrate: strava.max_heartrate ?? null,
    calories: strava.calories ?? null,
    description: strava.description ?? null,
    averageCadence: strava.average_cadence ?? null,
    averageWatts: strava.average_watts ?? null,
    kudosCount: strava.kudos_count,
    commentCount: strava.comment_count,
    summaryPolyline: strava.map?.summary_polyline ?? null,
    startLatlng,
    endLatlng,
    startLat,
    startLng,
    endLat,
    endLng,
    deviceName: strava.device_name ?? null,
    gearId: strava.gear_id ?? null,
    maxWatts: null, // Strava doesn't provide this in API response
    weightedAverageWatts: strava.weighted_average_watts ?? null,
    kilojoules: strava.kilojoules ?? null,
    sufferScore: null, // Would require separate API call
    elevHigh: strava.elev_high ?? null,
    elevLow: strava.elev_low ?? null,
    photosJson,
    hasDetailedData: true, // Mark as having detailed data
  };
}

/**
 * Convert Strava lap to ActivityLapInput for database storage
 */
function mapStravaLapToInput(lap: StravaDetailedActivity['laps'][0]): ActivityLapInput {
  const startDate = Math.floor(new Date(lap.start_date).getTime() / 1000);

  return {
    activityId: lap.activity.id,
    lapIndex: lap.lap_index,
    name: lap.name,
    distanceMeters: lap.distance,
    elapsedTimeSeconds: lap.elapsed_time,
    movingTimeSeconds: lap.moving_time,
    startDate,
    totalElevationGain: lap.total_elevation_gain ?? null,
    averageSpeed: lap.average_speed ?? null,
    maxSpeed: lap.max_speed ?? null,
    averageHeartrate: lap.average_heartrate ?? null,
    maxHeartrate: lap.max_heartrate ?? null,
    averageCadence: null, // Not provided in Strava lap data
    averageWatts: null, // Not provided in Strava lap data
  };
}

/**
 * Convert Strava split metric to ActivitySplitMetricInput for database storage
 */
function mapStravaSplitMetricToInput(
  split: StravaDetailedActivity['splits_metric'][0],
  activityId: number
): ActivitySplitMetricInput {
  return {
    activityId,
    split: split.split,
    distanceMeters: split.distance,
    elapsedTimeSeconds: split.elapsed_time,
    movingTimeSeconds: split.moving_time,
    elevationDifference: split.elevation_difference ?? null,
    averageSpeed: split.average_speed ?? null,
    paceZone: split.pace_zone ?? null,
  };
}

/**
 * Convert Strava best effort to ActivityBestEffortInput for database storage
 */
function mapStravaBestEffortToInput(
  effort: StravaDetailedActivity['best_efforts'][0]
): ActivityBestEffortInput {
  const startDate = Math.floor(new Date(effort.start_date).getTime() / 1000);

  return {
    activityId: effort.activity.id,
    stravaEffortId: effort.id,
    name: effort.name,
    distanceMeters: effort.distance,
    elapsedTimeSeconds: effort.elapsed_time,
    movingTimeSeconds: effort.moving_time,
    startDate,
    prRank: effort.pr_rank ?? null,
  };
}

/**
 * Convert Strava segment effort to ActivitySegmentEffortInput for database storage
 */
function mapStravaSegmentEffortToInput(
  effort: StravaDetailedActivity['segment_efforts'][0]
): ActivitySegmentEffortInput {
  const startDate = Math.floor(new Date(effort.start_date).getTime() / 1000);

  return {
    activityId: effort.activity.id,
    stravaEffortId: effort.id,
    segmentId: effort.segment.id,
    segmentName: effort.segment.name,
    distanceMeters: effort.distance,
    elapsedTimeSeconds: effort.elapsed_time,
    movingTimeSeconds: effort.moving_time,
    startDate,
    averageHeartrate: effort.average_heartrate ?? null,
    maxHeartrate: effort.max_heartrate ?? null,
    averageCadence: effort.average_cadence ?? null,
    averageWatts: effort.average_watts ?? null,
    komRank: effort.kom_rank ?? null,
    prRank: effort.pr_rank ?? null,
    hidden: effort.hidden,
  };
}

/**
 * Convert Strava detailed activity to DetailedActivityData for database storage
 */
export function mapStravaDetailedActivityToDetailedData(
  strava: StravaDetailedActivity,
  userId: number
): DetailedActivityData {
  const activity = mapStravaDetailedActivityToActivityInput(strava, userId);

  const laps = strava.laps?.map(mapStravaLapToInput) ?? undefined;
  const splitsMetric = strava.splits_metric?.map(split =>
    mapStravaSplitMetricToInput(split, strava.id)
  ) ?? undefined;
  const bestEfforts = strava.best_efforts?.map(mapStravaBestEffortToInput) ?? undefined;
  const segmentEfforts = strava.segment_efforts?.map(mapStravaSegmentEffortToInput) ?? undefined;

  return {
    activity,
    laps,
    splitsMetric,
    bestEfforts,
    segmentEfforts,
  };
}
