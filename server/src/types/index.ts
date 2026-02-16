/**
 * Application types - generated from OpenAPI specification
 *
 * These are the canonical types used throughout the application.
 * Strava-specific types are isolated in services/strava/types.ts
 */

export type { components, operations, paths } from './api.generated';

// Convenience type aliases for common use
import type { components } from './api.generated';

export type Activity = components['schemas']['Activity'];
export type ActivityType = components['schemas']['ActivityType'];
export type DetailedActivity = components['schemas']['DetailedActivity'];
export type Lap = components['schemas']['Lap'];
export type Split = components['schemas']['Split'];
export type User = components['schemas']['User'];
export type GetActivitiesResponse = components['schemas']['GetActivitiesResponse'];
export type GetActivityResponse = components['schemas']['GetActivityResponse'];
export type GetActivityStatsResponse = components['schemas']['GetActivityStatsResponse'];
export type DailyStatsItem = components['schemas']['DailyStatsItem'];
export type GetDailyStatsResponse = components['schemas']['GetDailyStatsResponse'];
export type StatsPeriod = components['schemas']['StatsPeriod'];
export type GetMeResponse = components['schemas']['GetMeResponse'];
export type GetAuthUrlRequest = components['schemas']['GetAuthUrlRequest'];
export type GetAuthUrlResponse = components['schemas']['GetAuthUrlResponse'];
export type LogoutResponse = components['schemas']['LogoutResponse'];
export type GetActivityStreamsResponse = components['schemas']['GetActivityStreamsResponse'];
