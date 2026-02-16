import { METERS_PER_KM, SECONDS_PER_HOUR, SECONDS_PER_MINUTE, MS_TO_KMH } from './constants';
import type { ActivityType } from '../../types';

/**
 * Format distance in meters to kilometers with 1 decimal place
 */
export function formatDistance(meters: number): string {
  return (meters / METERS_PER_KM).toFixed(1) + ' km';
}

/**
 * Format duration in seconds to hours and minutes (e.g., "2h 30m" or "45m")
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Format pace in meters per second to min/km format (e.g., "5:30 /km")
 */
export function formatPace(metersPerSecond: number): string {
  if (metersPerSecond === 0) return '-';

  const minPerKm = (METERS_PER_KM / metersPerSecond) / SECONDS_PER_MINUTE;
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * SECONDS_PER_MINUTE);

  return `${mins}:${secs.toString().padStart(2, '0')} /km`;
}

/**
 * Format elevation in meters with proper locale string
 */
export function formatElevation(meters: number): string {
  return `${Math.round(meters).toLocaleString()}m`;
}

/**
 * Format calories
 */
export function formatCalories(calories: number): string {
  return `${Math.round(calories).toLocaleString()} kcal`;
}

/**
 * Format heart rate
 */
export function formatHeartRate(bpm: number): string {
  return `${Math.round(bpm)} bpm`;
}

// Activity types that use rpm for cadence (cycling)
const RPM_ACTIVITIES: ActivityType[] = ['Ride', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'VirtualRide'];

/**
 * Format cadence (steps or revolutions per minute)
 */
export function formatCadence(cadence: number, activityType: ActivityType): string {
  const unit = RPM_ACTIVITIES.includes(activityType) ? 'rpm' : 'spm';
  return `${Math.round(cadence)} ${unit}`;
}

/**
 * Format power in watts
 */
export function formatPower(watts: number): string {
  return `${Math.round(watts)} W`;
}

/**
 * Format speed in km/h
 */
export function formatSpeed(metersPerSecond: number): string {
  const kmh = metersPerSecond * MS_TO_KMH;
  return `${kmh.toFixed(1)} km/h`;
}
