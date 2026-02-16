/**
 * Simple migration runner for SQLite
 */

import type Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

/**
 * Load all migration files from the migrations directory
 */
export function loadMigrations(): Migration[] {
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

/**
 * Run pending migrations
 */
export function runMigrations(db: Database.Database): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `);

  // Get applied migrations
  const applied = new Set(
    (db.prepare('SELECT version FROM _migrations').all() as { version: number }[])
      .map(row => row.version)
  );

  // Load and run pending migrations
  const migrations = loadMigrations();

  for (const migration of migrations) {
    if (applied.has(migration.version)) continue;

    db.transaction(() => {
      db.exec(migration.sql);
      db.prepare('INSERT INTO _migrations (version, name) VALUES (?, ?)').run(
        migration.version,
        migration.name
      );
    })();
  }
}

/**
 * Get current schema version
 */
export function getCurrentVersion(db: Database.Database): number {
  try {
    const row = db.prepare('SELECT MAX(version) as version FROM _migrations').get() as { version: number | null };
    return row.version ?? 0;
  } catch {
    return 0;
  }
}
