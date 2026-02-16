/**
 * Webhook types for Strava event processing
 */

import { z } from 'zod';

/**
 * Strava webhook verification challenge schema
 * Sent as query parameters during subscription creation
 */
export const webhookVerificationSchema = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.challenge': z.string().min(1),
  'hub.verify_token': z.string().min(1),
});

export type WebhookVerification = z.infer<typeof webhookVerificationSchema>;

/**
 * Valid Strava activity types
 * Based on Strava API documentation and our supported types
 */
const STRAVA_ACTIVITY_TYPES = [
  'Run',
  'TrailRun',
  'VirtualRun',
  'Ride',
  'MountainBikeRide',
  'GravelRide',
  'EBikeRide',
  'VirtualRide',
  'Swim',
  'Walk',
  'Hike',
  'AlpineSki',
  'BackcountrySki',
  'NordicSki',
  'Workout',
  'WeightTraining',
  'Yoga',
  'Other',
] as const;

/**
 * Strava webhook event schema
 * Sent as JSON body for activity events
 */
export const webhookEventSchema = z.object({
  object_type: z.enum(['activity', 'athlete']),
  object_id: z.number().int().positive(),
  aspect_type: z.enum(['create', 'update', 'delete']),
  updates: z
    .object({
      title: z.string().optional(),
      type: z.enum(STRAVA_ACTIVITY_TYPES).optional(),
      // Strava sends "true"/"false" as strings, not booleans
      private: z
        .enum(['true', 'false'])
        .transform((val) => val === 'true')
        .optional(),
      authorized: z
        .enum(['true', 'false'])
        .transform((val) => val === 'true')
        .optional(),
    })
    .optional(),
  owner_id: z.number().int().positive(),
  subscription_id: z.number().int().positive(),
  event_time: z.number().int().positive(),
});

export type WebhookEvent = z.infer<typeof webhookEventSchema>;

/**
 * Webhook event processing status
 * - pending: Event received, waiting to be processed
 * - processing: Event is currently being processed by a worker
 * - processed: Event successfully processed
 * - failed: Event processing failed after retries
 */
export type WebhookEventStatus = 'pending' | 'processing' | 'processed' | 'failed';

/**
 * Stored webhook event in database
 */
export interface StoredWebhookEvent {
  id: number;
  subscriptionId: number;
  ownerId: number;
  objectType: 'activity' | 'athlete';
  objectId: number;
  aspectType: 'create' | 'update' | 'delete';
  updatesJson: string | null;
  eventTime: number;
  status: WebhookEventStatus;
  retryCount: number;
  lastRetryAt: number | null;
  processedAt: number | null;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Input for creating a webhook event record
 */
export interface WebhookEventInput {
  subscriptionId: number;
  ownerId: number;
  objectType: 'activity' | 'athlete';
  objectId: number;
  aspectType: 'create' | 'update' | 'delete';
  updatesJson?: string | null;
  eventTime: number;
}
