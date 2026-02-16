/**
 * Athlete controller
 * Handles fetching athlete profile and statistics
 */

import { Request, Response, NextFunction } from 'express';
import { LRUCache } from '../services/cache/cache';
import { UnauthorizedError } from '../utils/errors';
import { StravaClient } from '../services/strava/client';
import {
  getAuthenticatedAthlete,
  getAthleteStats,
} from '../services/strava/athlete';
import { StravaAthlete, StravaAthleteStats } from '../services/strava/types';
import { logger } from '../utils/logger';

export function createAthleteController(cache: LRUCache<unknown>) {
  /**
   * GET /api/athlete
   * Get authenticated athlete's profile
   */
  const getProfile = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.session) {
        throw new UnauthorizedError('Authentication required');
      }

      const { userId, accessToken } = req.session;

      // Generate cache key
      const cacheKey = LRUCache.scopedKey(userId, 'athlete:profile');

      // Check cache
      const cached = cache.get(cacheKey) as StravaAthlete | undefined;
      if (cached) {
        logger.debug('Athlete profile retrieved from cache', { userId });
        res.json({ athlete: cached, cached: true });
        return;
      }

      // Fetch from Strava
      const client = new StravaClient(accessToken);
      const athlete = await getAuthenticatedAthlete(client);

      // Cache for 10 minutes
      cache.set(cacheKey, athlete, 600);

      logger.info('Athlete profile fetched and cached', {
        userId,
        athleteId: athlete.id,
      });

      res.json({ athlete, cached: false });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/athlete/stats
   * Get athlete statistics using Strava's /athletes/{id}/stats endpoint
   */
  const getStats = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.session) {
        throw new UnauthorizedError('Authentication required');
      }

      const { userId, accessToken, user } = req.session;
      const athleteId = user.id;

      // Generate cache key
      const cacheKey = LRUCache.scopedKey(userId, 'athlete:stats');

      // Check cache
      const cached = cache.get(cacheKey) as StravaAthleteStats | undefined;
      if (cached) {
        logger.debug('Athlete stats retrieved from cache', { userId });
        res.json({ stats: cached, cached: true });
        return;
      }

      // Fetch from Strava
      // Note: Use athleteId from session.user.id, NOT session.userId
      // session.userId is the internal database ID, athleteId is Strava's athlete ID
      const client = new StravaClient(accessToken);
      const stats = await getAthleteStats(client, athleteId);

      // Cache for 5 minutes (stats change frequently)
      cache.set(cacheKey, stats, 300);

      logger.info('Athlete stats fetched and cached', {
        userId,
        ytdRideCount: stats.ytd_ride_totals.count,
        ytdRunCount: stats.ytd_run_totals.count,
      });

      res.json({ stats, cached: false });
    } catch (error) {
      next(error);
    }
  };

  return {
    getProfile,
    getStats,
  };
}
