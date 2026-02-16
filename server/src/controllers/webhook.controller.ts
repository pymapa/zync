/**
 * Webhook controller
 * Handles Strava webhook verification and event processing
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { logger } from '../utils/logger';
import { ValidationError, AppError, ErrorCode } from '../utils/errors';
import { secureCompare } from '../utils/crypto';
import { getDatabase } from '../services/database';
import {
  webhookVerificationSchema,
  webhookEventSchema,
  type WebhookEvent,
} from '../types/webhook';

export function createWebhookController() {
  /**
   * GET /api/webhooks/strava
   * Handle webhook subscription verification challenge from Strava
   *
   * Strava sends a GET request with query parameters to verify the callback URL:
   * - hub.mode: 'subscribe'
   * - hub.verify_token: The verification token we set when creating the subscription
   * - hub.challenge: A random string we must echo back
   *
   * We must respond within 2 seconds with the hub.challenge value or the
   * subscription will fail.
   */
  const handleVerification = (
    req: Request,
    res: Response,
    next: NextFunction
  ): void => {
    try {
      // Validate query parameters
      const verification = webhookVerificationSchema.parse(req.query);

      // Verify the token using constant-time comparison to prevent timing attacks
      const expectedToken = config.strava.webhookVerifyToken;
      if (!secureCompare(verification['hub.verify_token'], expectedToken)) {
        logger.warn('Webhook verification failed: invalid token', {
          receivedMode: verification['hub.mode'],
          ip: req.ip,
        });
        throw new ValidationError('Invalid verification token');
      }

      logger.info('Webhook verification successful', {
        challenge: verification['hub.challenge'],
      });

      // Echo back the challenge to complete verification
      res.json({
        'hub.challenge': verification['hub.challenge'],
      });
    } catch (error) {
      // Return 403 for verification failures as per Strava documentation
      if (error instanceof ValidationError) {
        res.status(403).json({
          error: {
            code: 'VERIFICATION_FAILED',
            message: 'Webhook verification failed',
          },
        });
        return;
      }
      next(error);
    }
  };

  /**
   * POST /api/webhooks/strava
   * Receive webhook events from Strava
   *
   * Strava sends POST requests for activity events:
   * - aspect_type: 'create', 'update', or 'delete'
   * - object_type: 'activity' or 'athlete'
   * - object_id: The activity or athlete ID
   * - owner_id: The athlete ID who owns the object
   * - subscription_id: The webhook subscription ID
   * - event_time: Unix timestamp when the event occurred
   * - updates: Object with changed fields (for update events only)
   *
   * Security: Strava does not provide HMAC signatures for webhooks. As an additional
   * security measure, we validate the subscription_id against our configured value.
   * This is not cryptographically secure but provides basic protection against
   * unauthorized event submissions.
   *
   * Event Processing: Events are stored immediately and acknowledged with a 200 OK
   * response as required by Strava (must respond within 2 seconds). Processing
   * happens asynchronously via a background worker that polls for unprocessed events
   * using getUnprocessedWebhookEvents() and marks them complete with
   * markWebhookEventProcessed().
   */
  const handleEvent = async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // Validate the webhook event payload
      const event: WebhookEvent = webhookEventSchema.parse(req.body);

      // Verify subscription ID matches our configured subscription
      // This provides basic protection since Strava doesn't use HMAC signatures
      const expectedSubscriptionId = config.strava.webhookSubscriptionId;
      if (
        expectedSubscriptionId &&
        event.subscription_id !== expectedSubscriptionId
      ) {
        logger.warn('Webhook rejected: invalid subscription ID', {
          received: event.subscription_id,
          expected: expectedSubscriptionId,
          ownerId: event.owner_id,
          ip: req.ip,
        });
        throw new ValidationError('Invalid subscription ID');
      }

      logger.info('Received webhook event', {
        aspectType: event.aspect_type,
        objectType: event.object_type,
        objectId: event.object_id,
        ownerId: event.owner_id,
        subscriptionId: event.subscription_id,
      });

      // Store the event in the database for asynchronous processing
      const db = getDatabase();
      try {
        db.createWebhookEvent({
          subscriptionId: event.subscription_id,
          ownerId: event.owner_id,
          objectType: event.object_type,
          objectId: event.object_id,
          aspectType: event.aspect_type,
          updatesJson: event.updates ? JSON.stringify(event.updates) : null,
          eventTime: event.event_time,
        });

        logger.info('Webhook event stored successfully', {
          aspectType: event.aspect_type,
          objectType: event.object_type,
          objectId: event.object_id,
          ownerId: event.owner_id,
        });
      } catch (dbError) {
        // Log database errors but don't expose internal details to caller
        logger.error('Failed to store webhook event', {
          error: dbError instanceof Error ? dbError.message : String(dbError),
          aspectType: event.aspect_type,
          objectId: event.object_id,
          ownerId: event.owner_id,
        });
        throw new AppError(
          500,
          ErrorCode.INTERNAL_ERROR,
          'Failed to store webhook event'
        );
      }

      // Respond immediately with 200 OK as per Strava requirements
      // Do not return internal database IDs or implementation details
      res.status(200).json({
        success: true,
      });
    } catch (error) {
      next(error);
    }
  };

  return {
    handleVerification,
    handleEvent,
  };
}
