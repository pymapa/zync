/**
 * Transformers for converting Strava API types to database types
 *
 * This module provides type-safe transformations between external Strava API
 * responses and internal database storage types.
 */

import type {
  StravaActivity,
  StravaDetailedActivity,
  Lap,
  SplitMetric,
  BestEffort,
  SegmentEffort,
  PhotosSummary,
} from '../strava/types';
import type {
  ActivityInput,
  DetailedActivityData,
  ActivityLapInput,
  ActivitySplitMetricInput,
  ActivityBestEffortInput,
  ActivitySegmentEffortInput,
} from './types';

/**
 * Convert ISO 8601 date string to Unix timestamp in seconds
 */
function isoToUnixSeconds(isoString: string): number {
  return Math.floor(new Date(isoString).getTime() / 1000);
}

/**
 * Transform Strava SummaryActivity to database ActivityInput
 */
export function transformSummaryActivity(
  stravaActivity: StravaActivity,
  userId: number
): ActivityInput {
  return {
    id: stravaActivity.id,
    userId,
    name: stravaActivity.name,
    type: stravaActivity.sport_type,
    distanceMeters: stravaActivity.distance,
    movingTimeSeconds: stravaActivity.moving_time,
    elapsedTimeSeconds: stravaActivity.elapsed_time,
    elevationGainMeters: stravaActivity.total_elevation_gain,
    startDate: isoToUnixSeconds(stravaActivity.start_date),
    startDateLocal: stravaActivity.start_date_local,
    averageSpeed: stravaActivity.average_speed,
    maxSpeed: stravaActivity.max_speed,
    averageHeartrate: stravaActivity.average_heartrate ?? null,
    maxHeartrate: stravaActivity.max_heartrate ?? null,
    calories: null, // Not available in summary
    description: null, // Not available in summary
    averageCadence: stravaActivity.average_cadence ?? null,
    averageWatts: stravaActivity.average_watts ?? null,
    kudosCount: stravaActivity.kudos_count,
    commentCount: stravaActivity.comment_count,
    summaryPolyline: stravaActivity.map?.summary_polyline ?? null,
    startLatlng: stravaActivity.start_latlng
      ? JSON.stringify(stravaActivity.start_latlng)
      : null,
    endLatlng: stravaActivity.end_latlng
      ? JSON.stringify(stravaActivity.end_latlng)
      : null,
    startLat: stravaActivity.start_latlng?.[0] ?? null,
    startLng: stravaActivity.start_latlng?.[1] ?? null,
    endLat: stravaActivity.end_latlng?.[0] ?? null,
    endLng: stravaActivity.end_latlng?.[1] ?? null,
    // Summary activities don't have detailed data
    deviceName: null,
    gearId: stravaActivity.gear_id ?? null,
    maxWatts: null,
    weightedAverageWatts: stravaActivity.weighted_average_watts ?? null,
    kilojoules: stravaActivity.kilojoules ?? null,
    sufferScore: null,
    elevHigh: stravaActivity.elev_high ?? null,
    elevLow: stravaActivity.elev_low ?? null,
    photosJson: null,
    hasDetailedData: false,
  };
}

/**
 * Transform Strava DetailedActivity to database DetailedActivityData
 */
export function transformDetailedActivity(
  stravaActivity: StravaDetailedActivity,
  userId: number
): DetailedActivityData {
  const activity: ActivityInput = {
    id: stravaActivity.id,
    userId,
    name: stravaActivity.name,
    type: stravaActivity.sport_type,
    distanceMeters: stravaActivity.distance,
    movingTimeSeconds: stravaActivity.moving_time,
    elapsedTimeSeconds: stravaActivity.elapsed_time,
    elevationGainMeters: stravaActivity.total_elevation_gain,
    startDate: isoToUnixSeconds(stravaActivity.start_date),
    startDateLocal: stravaActivity.start_date_local,
    averageSpeed: stravaActivity.average_speed,
    maxSpeed: stravaActivity.max_speed,
    averageHeartrate: stravaActivity.average_heartrate ?? null,
    maxHeartrate: stravaActivity.max_heartrate ?? null,
    calories: stravaActivity.calories ?? null,
    description: stravaActivity.description ?? null,
    averageCadence: stravaActivity.average_cadence ?? null,
    averageWatts: stravaActivity.average_watts ?? null,
    kudosCount: stravaActivity.kudos_count,
    commentCount: stravaActivity.comment_count,
    summaryPolyline: stravaActivity.map?.summary_polyline ?? null,
    startLatlng: stravaActivity.start_latlng
      ? JSON.stringify(stravaActivity.start_latlng)
      : null,
    endLatlng: stravaActivity.end_latlng
      ? JSON.stringify(stravaActivity.end_latlng)
      : null,
    startLat: stravaActivity.start_latlng?.[0] ?? null,
    startLng: stravaActivity.start_latlng?.[1] ?? null,
    endLat: stravaActivity.end_latlng?.[0] ?? null,
    endLng: stravaActivity.end_latlng?.[1] ?? null,
    deviceName: stravaActivity.device_name ?? null,
    gearId: stravaActivity.gear?.id ?? null,
    maxWatts: null, // Strava doesn't provide max_watts in activity (only in streams)
    weightedAverageWatts: stravaActivity.weighted_average_watts ?? null,
    kilojoules: stravaActivity.kilojoules ?? null,
    sufferScore: stravaActivity.calories ?? null, // Suffer score often stored as calories
    elevHigh: stravaActivity.elev_high ?? null,
    elevLow: stravaActivity.elev_low ?? null,
    photosJson: stravaActivity.photos ? JSON.stringify(stravaActivity.photos) : null,
    hasDetailedData: true,
  };

  // Transform laps
  const laps: ActivityLapInput[] | undefined = stravaActivity.laps?.map((lap: Lap) => ({
    activityId: stravaActivity.id,
    lapIndex: lap.lap_index,
    name: lap.name,
    distanceMeters: lap.distance,
    elapsedTimeSeconds: lap.elapsed_time,
    movingTimeSeconds: lap.moving_time,
    startDate: isoToUnixSeconds(lap.start_date),
    totalElevationGain: lap.total_elevation_gain,
    averageSpeed: lap.average_speed,
    maxSpeed: lap.max_speed,
    averageHeartrate: lap.average_heartrate ?? null,
    maxHeartrate: lap.max_heartrate ?? null,
    averageCadence: null, // Lap doesn't have cadence in Strava API
    averageWatts: null, // Lap doesn't have watts in Strava API
  }));

  // Transform metric splits
  const splitsMetric: ActivitySplitMetricInput[] | undefined = stravaActivity.splits_metric?.map(
    (split: SplitMetric) => ({
      activityId: stravaActivity.id,
      split: split.split,
      distanceMeters: split.distance,
      elapsedTimeSeconds: split.elapsed_time,
      movingTimeSeconds: split.moving_time,
      elevationDifference: split.elevation_difference,
      averageSpeed: split.average_speed,
      paceZone: split.pace_zone,
    })
  );

  // Transform best efforts
  const bestEfforts: ActivityBestEffortInput[] | undefined = stravaActivity.best_efforts?.map(
    (effort: BestEffort) => ({
      activityId: stravaActivity.id,
      stravaEffortId: effort.id,
      name: effort.name,
      distanceMeters: effort.distance,
      elapsedTimeSeconds: effort.elapsed_time,
      movingTimeSeconds: effort.moving_time,
      startDate: isoToUnixSeconds(effort.start_date),
      prRank: effort.pr_rank ?? null,
    })
  );

  // Transform segment efforts
  const segmentEfforts: ActivitySegmentEffortInput[] | undefined =
    stravaActivity.segment_efforts?.map((effort: SegmentEffort) => ({
      activityId: stravaActivity.id,
      stravaEffortId: effort.id,
      segmentId: effort.segment.id,
      segmentName: effort.name,
      distanceMeters: effort.distance,
      elapsedTimeSeconds: effort.elapsed_time,
      movingTimeSeconds: effort.moving_time,
      startDate: isoToUnixSeconds(effort.start_date),
      averageHeartrate: effort.average_heartrate ?? null,
      maxHeartrate: effort.max_heartrate ?? null,
      averageCadence: effort.average_cadence ?? null,
      averageWatts: effort.average_watts ?? null,
      komRank: effort.kom_rank ?? null,
      prRank: effort.pr_rank ?? null,
      hidden: effort.hidden,
    }));

  return {
    activity,
    laps,
    splitsMetric,
    bestEfforts,
    segmentEfforts,
  };
}

/**
 * Batch transform summary activities
 */
export function transformSummaryActivities(
  stravaActivities: StravaActivity[],
  userId: number
): ActivityInput[] {
  return stravaActivities.map(activity => transformSummaryActivity(activity, userId));
}
