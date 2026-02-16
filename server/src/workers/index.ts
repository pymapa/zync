/**
 * Standalone webhook processor worker entry point
 *
 * This can be run separately from the main web server for
 * distributed deployments where you want dedicated worker processes.
 *
 * Usage:
 *   node dist/workers/index.js
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local'), override: true });

import { config } from '../config';
import { logger } from '../utils/logger';
import { initDatabase, getDatabase, closeDatabase } from '../services/database';
import { SessionStore } from '../services/session/store';
import { WebhookProcessor } from './webhook-processor';

function startWorker(): void {
  try {
    logger.info('Starting webhook processor worker');

    // Initialize database
    initDatabase();
    logger.info('Database initialized successfully');

    // Initialize session store
    const sessionStore = new SessionStore(config.cookie.maxAge);
    logger.info('Session store initialized');

    // Initialize webhook processor
    const webhookProcessor = new WebhookProcessor({
      database: getDatabase(),
      sessionStore,
      pollIntervalMs: 5000, // Poll every 5 seconds
      batchSize: 10, // Process up to 10 events per batch
      maxRetries: 3, // Retry failed events up to 3 times
      processingTimeoutSeconds: 300, // Reset stuck events after 5 minutes
    });

    // Start processing
    webhookProcessor.start();

    logger.info('Webhook processor worker started successfully', {
      nodeEnv: config.nodeEnv,
      pollIntervalMs: 5000,
      batchSize: 10,
    });

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received, shutting down webhook processor gracefully`);

      try {
        // Stop webhook processor
        await webhookProcessor.stop();
        logger.info('Webhook processor stopped');

        // Cleanup resources
        sessionStore.shutdown();
        closeDatabase();
        logger.info('Resources cleaned up');

        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', error as Error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught exception in worker', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason: unknown) => {
      logger.error('Unhandled rejection in worker', reason as Error);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start webhook processor worker', error as Error);
    process.exit(1);
  }
}

startWorker();
