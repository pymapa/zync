/**
 * Type mappers - transform Strava types to application types
 *
 * This is the ONLY place where Strava types are converted to application types.
 * All other code uses application types from ./index.ts
 */

import type { Activity, ActivityType, User, DetailedActivity, Lap, Split, BestEffort, SegmentEffort } from './index';
import type { StravaActivity, StravaAthlete, StravaDetailedActivity, Lap as StravaLap, SplitMetric, BestEffort as StravaBestEffort, SegmentEffort as StravaSegmentEffort } from '../services/strava/types';

/**
 * Map Strava sport_type to application ActivityType
 */
const ACTIVITY_TYPE_MAP: Record<string, ActivityType> = {
  Run: 'Run',
  TrailRun: 'TrailRun',
  VirtualRun: 'VirtualRun',
  Ride: 'Ride',
  MountainBikeRide: 'MountainBikeRide',
  GravelRide: 'GravelRide',
  EBikeRide: 'EBikeRide',
  EMountainBikeRide: 'EBikeRide',
  VirtualRide: 'VirtualRide',
  Swim: 'Swim',
  Walk: 'Walk',
  Hike: 'Hike',
  AlpineSki: 'AlpineSki',
  BackcountrySki: 'BackcountrySki',
  NordicSki: 'NordicSki',
  Workout: 'Workout',
  WeightTraining: 'WeightTraining',
  Yoga: 'Yoga',
  Snowboard: 'Snowboard',
  Crossfit: 'Crossfit',
  Kayaking: 'Kayaking',
};

/**
 * Map Strava activity to application Activity type
 */
export function mapStravaActivity(strava: StravaActivity): Activity {
  return {
    id: strava.id,
    name: strava.name,
    type: ACTIVITY_TYPE_MAP[strava.sport_type] ?? 'Other',
    distanceMeters: strava.distance,
    movingTimeSeconds: strava.moving_time,
    elapsedTimeSeconds: strava.elapsed_time,
    elevationGainMeters: strava.total_elevation_gain,
    startDate: strava.start_date,
    startDateLocal: strava.start_date_local,
    averageSpeed: strava.average_speed,
    maxSpeed: strava.max_speed,
    averageHeartRate: strava.average_heartrate ?? null,
    maxHeartRate: strava.max_heartrate ?? null,
    kudosCount: strava.kudos_count,
    commentCount: strava.comment_count,
  };
}

/**
 * Map Strava lap to application Lap type
 */
function mapStravaLap(strava: StravaLap): Lap {
  return {
    lapIndex: strava.lap_index,
    name: strava.name,
    distanceMeters: strava.distance,
    elapsedTimeSeconds: strava.elapsed_time,
    movingTimeSeconds: strava.moving_time,
    startDate: strava.start_date,
    totalElevationGain: strava.total_elevation_gain ?? null,
    averageSpeed: strava.average_speed ?? null,
    maxSpeed: strava.max_speed ?? null,
    averageHeartRate: strava.average_heartrate ?? null,
    maxHeartRate: strava.max_heartrate ?? null,
  };
}

/**
 * Map Strava split metric to application Split type
 */
function mapStravaSplit(strava: SplitMetric): Split {
  return {
    split: strava.split,
    distanceMeters: strava.distance,
    elapsedTimeSeconds: strava.elapsed_time,
    movingTimeSeconds: strava.moving_time,
    elevationDifference: strava.elevation_difference ?? null,
    averageSpeed: strava.average_speed ?? null,
    paceZone: strava.pace_zone ?? null,
  };
}

/**
 * Map Strava detailed activity to application DetailedActivity type
 */
export function mapStravaDetailedActivity(strava: StravaDetailedActivity): DetailedActivity {
  const baseActivity = mapStravaActivity(strava);

  return {
    ...baseActivity,
    description: strava.description ?? null,
    calories: strava.calories ?? null,
    averageCadence: strava.average_cadence ?? null,
    averageWatts: strava.average_watts ?? null,
    maxWatts: null, // Not provided by Strava API
    weightedAverageWatts: strava.weighted_average_watts ?? null,
    sufferScore: null, // Would need separate API call
    startLatLng: strava.start_latlng ?? null,
    endLatLng: strava.end_latlng ?? null,
    map: strava.map
      ? {
          polyline: null, // Full polyline only in detailed activity
          summaryPolyline: strava.map.summary_polyline ?? null,
        }
      : null,
    laps: strava.laps?.map(mapStravaLap) ?? null,
    splitsMetric: strava.splits_metric?.map(mapStravaSplit) ?? null,
    bestEfforts: strava.best_efforts?.map(mapStravaBestEffort) ?? null,
    segmentEfforts: strava.segment_efforts?.map(mapStravaSegmentEffort) ?? null,
    photos: strava.photos?.count > 0 || strava.photos?.primary ? {
      count: strava.photos.count,
      primary: strava.photos.primary ? {
        uniqueId: strava.photos.primary.unique_id,
        url100: strava.photos.primary.urls?.['100'],
        url600: strava.photos.primary.urls?.['600'],
        mediaType: strava.photos.primary.source,
      } : null,
    } : undefined,
    elevHigh: null,
    elevLow: null,
    kilojoules: null,
    deviceName: strava.device_name ?? null,
  };
}

function mapStravaBestEffort(strava: StravaBestEffort): BestEffort {
  return {
    name: strava.name,
    distanceMeters: strava.distance,
    elapsedTimeSeconds: strava.elapsed_time,
    movingTimeSeconds: strava.moving_time,
    prRank: strava.pr_rank ?? null,
  };
}

function mapStravaSegmentEffort(strava: StravaSegmentEffort): SegmentEffort {
  return {
    name: strava.name,
    distanceMeters: strava.distance,
    elapsedTimeSeconds: strava.elapsed_time,
    movingTimeSeconds: strava.moving_time,
    averageHeartRate: strava.average_heartrate ?? null,
    prRank: strava.pr_rank ?? null,
  };
}

/**
 * Map Strava athlete to application User type
 */
export function mapStravaAthlete(strava: StravaAthlete): User {
  return {
    id: strava.id,
    firstName: strava.firstname,
    lastName: strava.lastname,
    profileUrl: strava.profile,
    city: strava.city ?? null,
    state: strava.state ?? null,
    country: strava.country ?? null,
  };
}
