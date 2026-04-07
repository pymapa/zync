/**
 * Migration runner for PostgreSQL
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { logger } from '../../../utils/logger';

interface Migration {
  version: number;
  name: string;
  sql: string;
}

function loadMigrations(): Migration[] {
  const migrationsDir = __dirname;
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.match(/^\d{3}_.*\.sql$/))
    .sort();

  return files.map(file => {
    const match = file.match(/^(\d{3})_(.+)\.sql$/);
    if (!match || !match[1] || !match[2]) {
      throw new Error(`Invalid migration filename: ${file}`);
    }

    return {
      version: parseInt(match[1], 10),
      name: match[2],
      sql: fs.readFileSync(path.join(migrationsDir, file), 'utf-8'),
    };
  });
}

export async function runMigrations(pool: Pool): Promise<void> {
  const client = await pool.connect();

  try {
    // Create migrations tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL DEFAULT (EXTRACT(EPOCH FROM NOW())::INTEGER)
      )
    `);

    // Get applied migrations
    const { rows } = await client.query('SELECT version FROM _migrations');
    const applied = new Set(rows.map(row => row.version));

    // Load and run pending migrations
    const migrations = loadMigrations();

    for (const migration of migrations) {
      if (applied.has(migration.version)) continue;

      await client.query('BEGIN');
      try {
        await client.query(migration.sql);
        await client.query(
          'INSERT INTO _migrations (version, name) VALUES ($1, $2)',
          [migration.version, migration.name]
        );
        await client.query('COMMIT');
        logger.info('Applied migration', { version: migration.version, name: migration.name });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    client.release();
  }
}
