/**
 * Strava activities service
 */

import { StravaClient } from './client';
import { StravaActivity, StravaDetailedActivity, StravaStreamsResponse, StravaActivityPhoto } from './types';
import { logger } from '../../utils/logger';
import { ValidationError } from '../../utils/errors';

export interface GetActivitiesParams {
  page?: number;
  perPage?: number;
  before?: number; // Unix timestamp
  after?: number; // Unix timestamp
}

/**
 * Fetch paginated list of athlete activities
 */
export async function getActivities(
  client: StravaClient,
  params: GetActivitiesParams = {}
): Promise<StravaActivity[]> {
  const {
    page = 1,
    perPage = 30,
    before,
    after,
  } = params;

  // Validate pagination parameters
  if (page < 1) {
    throw new ValidationError('Page must be greater than 0');
  }

  if (perPage < 1 || perPage > 200) {
    throw new ValidationError('Per page must be between 1 and 200');
  }

  logger.debug('Fetching activities', { page, perPage, before, after });

  const queryParams: Record<string, unknown> = {
    page,
    per_page: perPage,
  };

  if (before !== undefined) {
    queryParams.before = before;
  }

  if (after !== undefined) {
    queryParams.after = after;
  }

  const activities = await client.get<StravaActivity[]>(
    '/athlete/activities',
    queryParams
  );

  logger.info('Activities fetched successfully', {
    count: activities.length,
    page,
    perPage,
  });

  return activities;
}

/**
 * Fetch detailed information about a single activity
 */
export async function getActivityById(
  client: StravaClient,
  activityId: number
): Promise<StravaDetailedActivity> {
  if (!Number.isInteger(activityId) || activityId <= 0) {
    throw new ValidationError('Activity ID must be a positive integer');
  }

  logger.debug('Fetching activity details', { activityId });

  const activity = await client.get<StravaDetailedActivity>(
    `/activities/${activityId}`
  );

  logger.info('Activity details fetched successfully', {
    activityId,
    name: activity.name,
    type: activity.type,
  });

  return activity;
}

/**
 * Fetch photos for an activity
 */
export async function getActivityPhotos(
  client: StravaClient,
  activityId: number,
  size: number = 600
): Promise<StravaActivityPhoto[]> {
  if (!Number.isInteger(activityId) || activityId <= 0) {
    throw new ValidationError('Activity ID must be a positive integer');
  }

  logger.debug('Fetching activity photos', { activityId, size });

  const photos = await client.get<StravaActivityPhoto[]>(
    `/activities/${activityId}/photos`,
    { size, photo_sources: true }
  );

  logger.info('Activity photos fetched successfully', {
    activityId,
    count: photos.length,
  });

  return photos;
}

const DEFAULT_STREAM_TYPES = ['time', 'heartrate', 'velocity_smooth', 'altitude', 'watts'];

/**
 * Fetch stream data for an activity
 */
export async function getActivityStreams(
  client: StravaClient,
  activityId: number,
  streamTypes: string[] = DEFAULT_STREAM_TYPES
): Promise<StravaStreamsResponse> {
  if (!Number.isInteger(activityId) || activityId <= 0) {
    throw new ValidationError('Activity ID must be a positive integer');
  }

  logger.debug('Fetching activity streams', { activityId, streamTypes });

  const streams = await client.get<StravaStreamsResponse>(
    `/activities/${activityId}/streams`,
    { keys: streamTypes.join(','), key_by_type: true }
  );

  logger.info('Activity streams fetched successfully', {
    activityId,
    availableStreams: Object.keys(streams),
  });

  return streams;
}
