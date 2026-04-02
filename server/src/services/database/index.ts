/**
 * Database module entry point
 *
 * Exports database interface and creates singleton instance.
 */

import { Pool } from 'pg';
import { PostgresDatabase } from './postgres';
import type { IDatabase } from './interface';

// Re-export types and interface for consumers
export type { IDatabase } from './interface';
export type {
  SyncStatus,
  StoredActivity,
  ActivityInput,
  ActivitySearchFilters,
  SyncStatusUpdate,
  ActivityStats,
  ActivityStatsFilters,
  DailyActivityStats,
} from './types';

// Re-export geohash utilities for location-based queries
export {
  encodeGeohash,
  decodeGeohash,
  decodeGeohashBounds,
  getGeohashNeighbors,
  getGeohashesForBounds,
} from './geohash';

// Singleton database instance
let db: IDatabase | null = null;

/**
 * Initialize the database
 * Call this once at application startup
 */
export async function initDatabase(pool: Pool): Promise<void> {
  if (db) {
    throw new Error('Database already initialized');
  }
  db = new PostgresDatabase(pool);
  await db.init();
}

/**
 * Get the database instance
 * Throws if database hasn't been initialized
 */
export function getDatabase(): IDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection
 * Call this on application shutdown
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}
