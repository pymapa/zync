/**
 * Activities controller
 * Handles HTTP requests for activities
 */

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { LRUCache } from '../services/cache/cache';
import { ActivitiesService, DataSource, StatsPeriod } from '../services/activities';
import { UnauthorizedError, NotFoundError } from '../utils/errors';
import type { GetActivitiesResponse, GetActivityResponse, GetActivityStatsResponse, GetDailyStatsResponse } from '../types';

// Validation schemas
const listActivitiesQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  perPage: z.coerce.number().min(1).max(200).default(30),
  before: z.coerce.number().optional(),
  after: z.coerce.number().optional(),
  source: z.enum(['strava', 'local']).optional(),
  // Filters
  search: z.string().optional(),
  category: z.string().optional(),
  date: z.string().optional(),
  distance: z.string().optional(),
  duration: z.string().optional(),
  hasHeartRate: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
});

const getActivityParamsSchema = z.object({
  id: z.coerce.number().positive(),
});

const getActivityQuerySchema = z.object({
  source: z.enum(['strava', 'local']).optional(),
});

const getStatsQuerySchema = z.object({
  period: z.enum(['week', 'last_week', 'month', 'year', 'last_year', 'all']).default('week'),
});

// Category to activity types mapping (must match frontend CATEGORIES)
const CATEGORY_TYPES: Record<string, string[]> = {
  all: [],
  running: ['Run', 'TrailRun', 'VirtualRun'],
  cycling: ['Ride', 'MountainBikeRide', 'GravelRide', 'EBikeRide', 'VirtualRide'],
  water: ['Swim'],
  outdoor: ['Walk', 'Hike'],
  alpine: ['AlpineSki', 'BackcountrySki', 'Snowboard', 'Snowshoe', 'IceSkate'],
  xc: ['NordicSki', 'RollerSki'],
  fitness: ['Workout', 'WeightTraining', 'Yoga'],
};

// Helper to convert date preset to timestamp range
function getDateRange(preset?: string): { startDateFrom?: number; startDateTo?: number } {
  if (!preset || preset === 'all') return {};

  const now = Math.floor(Date.now() / 1000);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStart = Math.floor(today.getTime() / 1000);

  switch (preset) {
    case 'today':
      return { startDateFrom: todayStart };
    case 'week': {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { startDateFrom: Math.floor(weekAgo.getTime() / 1000) };
    }
    case 'month': {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return { startDateFrom: Math.floor(monthAgo.getTime() / 1000) };
    }
    case 'year': {
      const yearAgo = new Date(today);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      return { startDateFrom: Math.floor(yearAgo.getTime() / 1000) };
    }
    default:
      return {};
  }
}

// Helper to convert distance preset to meter range
function getDistanceRange(preset?: string): { minDistance?: number; maxDistance?: number } {
  if (!preset || preset === 'any') return {};

  switch (preset) {
    case 'short':
      return { maxDistance: 5000 };
    case 'medium':
      return { minDistance: 5000, maxDistance: 15000 };
    case 'long':
      return { minDistance: 15000, maxDistance: 30000 };
    case 'ultra':
      return { minDistance: 30000 };
    default:
      return {};
  }
}

// Helper to convert duration preset to second range
function getDurationRange(preset?: string): { minDuration?: number; maxDuration?: number } {
  if (!preset || preset === 'any') return {};

  switch (preset) {
    case 'quick':
      return { maxDuration: 1800 }; // 30 min
    case 'medium':
      return { minDuration: 1800, maxDuration: 3600 }; // 30-60 min
    case 'long':
      return { minDuration: 3600, maxDuration: 7200 }; // 1-2h
    case 'ultra':
      return { minDuration: 7200 }; // 2h+
    default:
      return {};
  }
}

export function createActivitiesController(cache: LRUCache<unknown>) {
  const activitiesService = new ActivitiesService(cache);

  /**
   * GET /api/activities
   * List activities with pagination and optional time filters
   */
  const listActivities = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.session) {
        throw new UnauthorizedError('Authentication required');
      }

      const query = listActivitiesQuerySchema.parse(req.query);
      const { userId, accessToken } = req.session;

      // Convert filter presets to actual values
      const types = query.category && query.category !== 'all'
        ? CATEGORY_TYPES[query.category] || []
        : undefined;
      const dateRange = getDateRange(query.date);
      const distanceRange = getDistanceRange(query.distance);
      const durationRange = getDurationRange(query.duration);

      const result = await activitiesService.listActivities({
        userId,
        accessToken,
        page: query.page,
        perPage: query.perPage,
        before: query.before,
        after: query.after,
        source: (query.source as DataSource) || 'auto',
        search: query.search,
        types,
        ...dateRange,
        ...distanceRange,
        ...durationRange,
        hasHeartRate: query.hasHeartRate,
      });

      const response: GetActivitiesResponse = {
        activities: result.activities,
        page: result.page,
        perPage: result.perPage,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
        cached: result.cached,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/activities/:id
   * Get detailed information about a single activity
   */
  const getActivity = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.session) {
        throw new UnauthorizedError('Authentication required');
      }

      const params = getActivityParamsSchema.parse(req.params);
      const query = getActivityQuerySchema.parse(req.query);
      const { userId, accessToken } = req.session;

      const source = (query.source as DataSource) || 'auto';
      const result = await activitiesService.getActivity({
        userId,
        accessToken,
        activityId: params.id,
        source,
      });

      if (!result) {
        throw new NotFoundError(`Activity ${params.id} not found`);
      }

      const response: GetActivityResponse = {
        activity: result.activity,
        cached: result.cached,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/activities/stats
   * Get aggregated activity stats for a time period
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

      const query = getStatsQuerySchema.parse(req.query);
      const { userId } = req.session;

      const result = activitiesService.getStats({
        userId,
        period: query.period as StatsPeriod,
      });

      const response: GetActivityStatsResponse = result;

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/activities/stats/daily
   * Get daily activity stats for charts
   */
  const getDailyStats = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.session) {
        throw new UnauthorizedError('Authentication required');
      }

      const query = getStatsQuerySchema.parse(req.query);
      const { userId } = req.session;

      const result = activitiesService.getDailyStats({
        userId,
        period: query.period as StatsPeriod,
      });

      const response: GetDailyStatsResponse = result;

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/activities/:id/streams
   * Get stream data for an activity
   */
  const getStreams = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.session) {
        throw new UnauthorizedError('Authentication required');
      }

      const params = getActivityParamsSchema.parse(req.params);
      const { userId, accessToken } = req.session;

      const result = await activitiesService.getStreams({
        userId,
        accessToken,
        activityId: params.id,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/activities/:id/photos
   * Get all photos for an activity from Strava
   */
  const getPhotos = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.session) {
        throw new UnauthorizedError('Authentication required');
      }

      const params = getActivityParamsSchema.parse(req.params);
      const { userId, accessToken } = req.session;

      const result = await activitiesService.getPhotos({
        userId,
        accessToken,
        activityId: params.id,
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  return {
    listActivities,
    getActivity,
    getStats,
    getDailyStats,
    getStreams,
    getPhotos,
  };
}
