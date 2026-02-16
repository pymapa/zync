/**
 * Webhook Event Processor Worker
 *
 * Processes webhook events from Strava by:
 * 1. Polling for unprocessed events from the database
 * 2. Fetching athlete access tokens (refreshing if expired)
 * 3. Calling Strava API to fetch activity data
 * 4. Storing activity data in the database
 * 5. Marking events as processed or failed
 *
 * Features:
 * - Rate limit handling (respects Strava's 200/15min, 2000/day limits)
 * - Automatic token refresh when expired
 * - Retry logic for transient failures
 * - Graceful shutdown
 * - Comprehensive error logging
 */

import { IDatabase } from '../services/database/interface';
import { SessionStore } from '../services/session/store';
import { StravaClient } from '../services/strava/client';
import { getActivityById } from '../services/strava/activities';
import { TokenManager } from '../services/strava/token-manager';
import { transformDetailedActivity } from '../services/database/transformers';
import { logger } from '../utils/logger';
import { AppError, ErrorCode } from '../utils/errors';
import type { StoredWebhookEvent } from '../types/webhook';

interface WebhookProcessorConfig {
  database: IDatabase;
  sessionStore: SessionStore;
  pollIntervalMs: number;
  batchSize: number;
  maxRetries: number;
  processingTimeoutSeconds: number;
}

interface WebhookProcessorStats {
  eventsProcessed: number;
  eventsFailed: number;
  apiCallsMade: number;
  tokenRefreshes: number;
}

interface RateLimitState {
  fifteenMinuteRequests: number;
  fifteenMinuteWindowStart: number;
  dailyRequests: number;
  dailyWindowStart: number;
}

export class WebhookProcessor {
  private database: IDatabase;
  private sessionStore: SessionStore;
  private tokenManager: TokenManager;
  private pollIntervalMs: number;
  private batchSize: number;
  private maxRetries: number;
  private processingTimeoutSeconds: number;
  private running: boolean;
  private pollTimer: NodeJS.Timeout | null;
  private shutdownPromise: Promise<void> | null;
  private rateLimitState: RateLimitState;
  private stats: WebhookProcessorStats;

  // Strava rate limits: 200 requests per 15 minutes, 2000 per day
  private readonly RATE_LIMIT_15MIN = 200;
  private readonly RATE_LIMIT_DAILY = 2000;
  private readonly RATE_LIMIT_15MIN_MS = 15 * 60 * 1000;
  private readonly RATE_LIMIT_DAILY_MS = 24 * 60 * 60 * 1000;

  constructor(config: WebhookProcessorConfig) {
    this.database = config.database;
    this.sessionStore = config.sessionStore;
    this.tokenManager = new TokenManager(config.sessionStore);
    this.pollIntervalMs = config.pollIntervalMs;
    this.batchSize = config.batchSize;
    this.maxRetries = config.maxRetries;
    this.processingTimeoutSeconds = config.processingTimeoutSeconds;
    this.running = false;
    this.pollTimer = null;
    this.shutdownPromise = null;

    // Initialize rate limit tracking
    const now = Date.now();
    this.rateLimitState = {
      fifteenMinuteRequests: 0,
      fifteenMinuteWindowStart: now,
      dailyRequests: 0,
      dailyWindowStart: now,
    };

    // Initialize statistics
    this.stats = {
      eventsProcessed: 0,
      eventsFailed: 0,
      apiCallsMade: 0,
      tokenRefreshes: 0,
    };
  }

  /**
   * Start the webhook processor
   */
  start(): void {
    if (this.running) {
      logger.warn('Webhook processor already running');
      return;
    }

    this.running = true;
    logger.info('Starting webhook processor', {
      pollIntervalMs: this.pollIntervalMs,
      batchSize: this.batchSize,
      maxRetries: this.maxRetries,
    });

    // Reset stuck events that may have been processing when server crashed
    this.resetStuckEvents();

    // Start polling loop
    this.scheduleNextPoll();
  }

  /**
   * Stop the webhook processor gracefully
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    logger.info('Stopping webhook processor');
    this.running = false;

    // Cancel scheduled poll
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }

    // Wait for current processing to complete
    if (this.shutdownPromise) {
      await this.shutdownPromise;
    }

    logger.info('Webhook processor stopped');
  }

  /**
   * Schedule next poll iteration
   */
  private scheduleNextPoll(): void {
    if (!this.running) {
      return;
    }

    this.pollTimer = setTimeout(() => {
      this.pollAndProcess().catch((error) => {
        logger.error('Unexpected error in poll loop', error);
      });
    }, this.pollIntervalMs);
  }

  /**
   * Main polling and processing loop
   */
  private async pollAndProcess(): Promise<void> {
    try {
      // Reset rate limit windows if needed
      this.resetRateLimitWindowsIfNeeded();

      // Check if we're rate limited
      if (this.isRateLimited()) {
        const waitTimeMs = this.getWaitTimeForRateLimit();
        logger.info('Rate limit reached, waiting', {
          waitTimeMs,
          fifteenMinRequests: this.rateLimitState.fifteenMinuteRequests,
          dailyRequests: this.rateLimitState.dailyRequests,
        });

        // Wait before next poll
        this.scheduleNextPoll();
        return;
      }

      // Fetch unprocessed events
      const events = this.database.getUnprocessedWebhookEvents(this.batchSize);

      if (events.length === 0) {
        // No events to process, schedule next poll
        this.scheduleNextPoll();
        return;
      }

      logger.info('Processing webhook events batch', {
        count: events.length,
      });

      // Process events sequentially to respect rate limits
      for (const event of events) {
        if (!this.running) {
          logger.info('Stopping event processing due to shutdown');
          break;
        }

        try {
          await this.processEvent(event);
        } catch (error) {
          // Error already logged in processEvent
          // Continue processing other events
        }
      }

      // Schedule next poll
      this.scheduleNextPoll();
    } catch (error) {
      logger.error('Error in poll and process loop', error);
      // Schedule next poll even on error
      this.scheduleNextPoll();
    }
  }

  /**
   * Process a single webhook event
   */
  private async processEvent(event: StoredWebhookEvent): Promise<void> {
    const eventContext = {
      eventId: event.id,
      objectType: event.objectType,
      objectId: event.objectId,
      aspectType: event.aspectType,
      ownerId: event.ownerId,
    };

    logger.info('Processing webhook event', eventContext);

    try {
      // Handle different event types
      if (event.objectType === 'athlete') {
        await this.processAthleteEvent(event);
      } else if (event.objectType === 'activity') {
        await this.processActivityEvent(event);
      } else {
        throw new Error(`Unknown object type: ${event.objectType}`);
      }

      // Mark event as processed
      this.database.markWebhookEventProcessed(event.id);
      this.stats.eventsProcessed++;
      logger.info('Webhook event processed successfully', eventContext);
    } catch (error) {
      await this.handleEventError(event, error);
    }
  }

  /**
   * Process athlete webhook event (deauthorization)
   */
  private async processAthleteEvent(event: StoredWebhookEvent): Promise<void> {
    const updates = event.updatesJson ? JSON.parse(event.updatesJson) : {};

    // Check if athlete deauthorized
    if (updates.authorized === false) {
      logger.info('Athlete deauthorized, cleaning up', {
        athleteId: event.ownerId,
      });

      // Destroy all user sessions
      this.sessionStore.destroyUserSessions(event.ownerId);

      // Delete sync status and activities
      this.database.deleteSyncStatus(event.ownerId);
      this.database.deleteUserActivities(event.ownerId);

      logger.info('Athlete data cleaned up', {
        athleteId: event.ownerId,
      });
    }
  }

  /**
   * Process activity webhook event (create, update, delete)
   */
  private async processActivityEvent(event: StoredWebhookEvent): Promise<void> {
    const activityId = event.objectId;
    const userId = event.ownerId;

    // Handle activity deletion
    if (event.aspectType === 'delete') {
      logger.info('Deleting activity', { activityId, userId });

      // Check if activity exists
      const existingActivity = this.database.getActivityById(activityId, userId);
      if (existingActivity) {
        // Delete activity details (cascades to main activity due to foreign key)
        this.database.deleteActivityDetails(activityId);
        logger.info('Activity deleted', { activityId, userId });
      } else {
        logger.info('Activity already deleted or never existed', { activityId, userId });
      }
      return;
    }

    // For create/update events, fetch activity from Strava
    const tokenInfo = await this.getValidToken(userId);

    // Increment rate limit counter for activity fetch
    this.incrementRateLimit();
    this.stats.apiCallsMade++;

    // Fetch activity from Strava
    const client = new StravaClient(tokenInfo.accessToken);
    const detailedActivity = await getActivityById(client, activityId);

    // Transform and store activity
    const activityData = transformDetailedActivity(detailedActivity, userId);
    this.database.upsertDetailedActivity(activityData);

    logger.info('Activity stored from webhook', {
      activityId,
      userId,
      aspectType: event.aspectType,
    });
  }

  /**
   * Get a valid access token for a user, refreshing if necessary
   */
  private async getValidToken(
    userId: number
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const tokenInfo = await this.tokenManager.getValidToken(userId);

    // If token was refreshed, increment counters
    const now = Math.floor(Date.now() / 1000);
    if (tokenInfo.expiresAt > now + 3500) {
      // Token was likely just refreshed (new tokens expire in ~6 hours)
      this.incrementRateLimit();
      this.stats.apiCallsMade++;
      this.stats.tokenRefreshes++;
    }

    return tokenInfo;
  }

  /**
   * Handle errors during event processing
   */
  private async handleEventError(
    event: StoredWebhookEvent,
    error: unknown
  ): Promise<void> {
    const eventContext = {
      eventId: event.id,
      objectType: event.objectType,
      objectId: event.objectId,
      aspectType: event.aspectType,
      ownerId: event.ownerId,
      retryCount: event.retryCount,
    };

    logger.error('Error processing webhook event', error, eventContext);

    let errorMessage: string;
    let shouldRetry = false;

    if (error instanceof AppError) {
      errorMessage = `[${error.code}] ${error.message}`;

      // Retry on rate limit, timeout, or Strava API errors (5xx)
      if (
        error.code === ErrorCode.RATE_LIMIT_EXCEEDED ||
        error.code === ErrorCode.STRAVA_API_ERROR
      ) {
        shouldRetry = true;
      }

      // Don't retry on auth errors (user needs to re-authenticate)
      if (
        error.code === ErrorCode.UNAUTHORIZED ||
        error.code === ErrorCode.INVALID_TOKEN ||
        error.code === ErrorCode.FORBIDDEN
      ) {
        shouldRetry = false;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
      // Retry on unknown errors (might be transient)
      shouldRetry = true;
    } else {
      errorMessage = String(error);
      shouldRetry = true;
    }

    // Attempt retry if applicable and under max retries
    if (shouldRetry && event.retryCount < this.maxRetries) {
      const retried = this.database.retryWebhookEvent(event.id, this.maxRetries);

      if (retried) {
        logger.info('Webhook event queued for retry', {
          ...eventContext,
          nextRetryCount: event.retryCount + 1,
        });
        return;
      }
    }

    // Mark as failed if not retrying or max retries exceeded
    this.database.markWebhookEventProcessed(event.id, errorMessage);
    this.stats.eventsFailed++;
    logger.error('Webhook event marked as failed', error, {
      ...eventContext,
      errorMessage,
    });
  }

  /**
   * Reset stuck events on startup
   */
  private resetStuckEvents(): void {
    const resetCount = this.database.resetStuckWebhookEvents(
      this.processingTimeoutSeconds
    );

    if (resetCount > 0) {
      logger.info('Reset stuck webhook events', { count: resetCount });
    }
  }

  /**
   * Check if rate limited
   */
  private isRateLimited(): boolean {
    return (
      this.rateLimitState.fifteenMinuteRequests >= this.RATE_LIMIT_15MIN ||
      this.rateLimitState.dailyRequests >= this.RATE_LIMIT_DAILY
    );
  }

  /**
   * Get wait time until rate limit window resets
   */
  private getWaitTimeForRateLimit(): number {
    const now = Date.now();

    // Check 15-minute window
    if (this.rateLimitState.fifteenMinuteRequests >= this.RATE_LIMIT_15MIN) {
      const fifteenMinElapsed = now - this.rateLimitState.fifteenMinuteWindowStart;
      return Math.max(0, this.RATE_LIMIT_15MIN_MS - fifteenMinElapsed);
    }

    // Check daily window
    if (this.rateLimitState.dailyRequests >= this.RATE_LIMIT_DAILY) {
      const dailyElapsed = now - this.rateLimitState.dailyWindowStart;
      return Math.max(0, this.RATE_LIMIT_DAILY_MS - dailyElapsed);
    }

    return 0;
  }

  /**
   * Increment rate limit counters
   */
  private incrementRateLimit(): void {
    this.rateLimitState.fifteenMinuteRequests++;
    this.rateLimitState.dailyRequests++;
  }

  /**
   * Reset rate limit windows if time has passed
   */
  private resetRateLimitWindowsIfNeeded(): void {
    const now = Date.now();

    // Reset 15-minute window
    const fifteenMinElapsed = now - this.rateLimitState.fifteenMinuteWindowStart;
    if (fifteenMinElapsed >= this.RATE_LIMIT_15MIN_MS) {
      this.rateLimitState.fifteenMinuteRequests = 0;
      this.rateLimitState.fifteenMinuteWindowStart = now;
    }

    // Reset daily window
    const dailyElapsed = now - this.rateLimitState.dailyWindowStart;
    if (dailyElapsed >= this.RATE_LIMIT_DAILY_MS) {
      this.rateLimitState.dailyRequests = 0;
      this.rateLimitState.dailyWindowStart = now;
    }
  }

  /**
   * Get current rate limit state (for monitoring)
   */
  getRateLimitState(): Readonly<RateLimitState> {
    return { ...this.rateLimitState };
  }

  /**
   * Get processing statistics (for monitoring)
   */
  getStats(): Readonly<WebhookProcessorStats> {
    return { ...this.stats };
  }
}
