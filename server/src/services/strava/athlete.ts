/**
 * Strava athlete service
 */

import { StravaClient } from './client';
import { StravaAthlete, StravaAthleteStats } from './types';
import { logger } from '../../utils/logger';
import { ValidationError } from '../../utils/errors';

/**
 * Fetch authenticated athlete profile
 */
export async function getAuthenticatedAthlete(
  client: StravaClient
): Promise<StravaAthlete> {
  logger.debug('Fetching authenticated athlete profile');

  const athlete = await client.get<StravaAthlete>('/athlete');

  logger.info('Athlete profile fetched successfully', {
    athleteId: athlete.id,
    name: `${athlete.firstname} ${athlete.lastname}`,
  });

  return athlete;
}

/**
 * Fetch athlete statistics using Strava's /athletes/{id}/stats endpoint
 * This is the proper way to get stats, NOT fetching 500 activities
 */
export async function getAthleteStats(
  client: StravaClient,
  athleteId: number
): Promise<StravaAthleteStats> {
  if (!Number.isInteger(athleteId) || athleteId <= 0) {
    throw new ValidationError('Athlete ID must be a positive integer');
  }

  logger.debug('Fetching athlete stats', { athleteId });

  const stats = await client.get<StravaAthleteStats>(
    `/athletes/${athleteId}/stats`
  );

  logger.info('Athlete stats fetched successfully', {
    athleteId,
    ytdRideCount: stats.ytd_ride_totals.count,
    ytdRunCount: stats.ytd_run_totals.count,
    allRideCount: stats.all_ride_totals.count,
    allRunCount: stats.all_run_totals.count,
  });

  return stats;
}
