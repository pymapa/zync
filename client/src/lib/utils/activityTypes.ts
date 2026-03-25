import type { ActivityType } from '../../types';

/** Activities that display pace (min/km) instead of speed (km/h) */
const PACE_TYPES: ActivityType[] = ['Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike'];

/** Activities that display power metrics */
const POWER_TYPES: ActivityType[] = ['Ride', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'VirtualRide'];

/** Activities that display cadence */
const CADENCE_TYPES: ActivityType[] = [
  'Run', 'TrailRun', 'VirtualRun', 'Walk', 'Hike',
  'Ride', 'MountainBikeRide', 'GravelRide', 'VirtualRide',
];

/** Activities that are indoor / have no meaningful distance or map */
const INDOOR_TYPES: ActivityType[] = ['Workout', 'WeightTraining', 'Yoga'];

/** Running-family activities (show best efforts) */
const RUNNING_TYPES: ActivityType[] = ['Run', 'TrailRun', 'VirtualRun'];

/** Snowboard/alpine activities */
const SNOW_TYPES: ActivityType[] = ['Snowboard', 'AlpineSki'];

export function isPaceActivity(type: ActivityType): boolean {
  return PACE_TYPES.includes(type);
}

export function isPowerActivity(type: ActivityType): boolean {
  return POWER_TYPES.includes(type);
}

export function isCadenceActivity(type: ActivityType): boolean {
  return CADENCE_TYPES.includes(type);
}

export function isIndoorActivity(type: ActivityType): boolean {
  return INDOOR_TYPES.includes(type);
}

export function isRunningActivity(type: ActivityType): boolean {
  return RUNNING_TYPES.includes(type);
}

export function isSnowActivity(type: ActivityType): boolean {
  return SNOW_TYPES.includes(type);
}

export function getActivityColor(type: ActivityType): string {
  if (type.includes('Run') || type === 'TrailRun') return 'var(--activity-run)';
  if (type.includes('Ride') || type.includes('Bike')) return 'var(--activity-ride)';
  if (type === 'Swim') return 'var(--activity-swim)';
  if (type === 'Walk' || type === 'Hike') return 'var(--activity-walk)';
  if (type.includes('Ski') || type === 'Snowboard') return 'var(--activity-ski)';
  return 'var(--activity-workout)';
}
