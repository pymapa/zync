/**
 * Application entry point
 * Starts the Express server
 */

import dotenv from 'dotenv';
import path from 'path';

// Load .env first, then .env.local overrides
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env.local'), override: true });
import { config } from './config';
import { createApp } from './app';
import { logger } from './utils/logger';
import { closeDatabase } from './services/database/index';

function startServer(): void {
  try {
    const { app, services } = createApp();

    const server = app.listen(config.port, () => {
      logger.info('Server started successfully', {
        port: config.port,
        nodeEnv: config.nodeEnv,
        frontendUrl: config.frontend.url,
      });

    });

    // Graceful shutdown
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${signal} received, shutting down gracefully`);

      // Close HTTP server first (stop accepting new connections)
      server.close(async () => {
        logger.info('HTTP server closed');

        // Cleanup application resources
        try {
          services.sessionStore.shutdown();
          services.cache.shutdown();
          closeDatabase();
          logger.info('Application resources cleaned up');
        } catch (error) {
          logger.error('Error cleaning up resources', error as Error);
        }

        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught exception', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason: unknown) => {
      logger.error('Unhandled rejection', reason as Error);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

startServer();
