/**
 * Run database migrations manually
 * Usage: npm run db:migrate
 */

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.local'), override: true });

import { Pool } from 'pg';
import { initDatabase, closeDatabase } from '../services/database';

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  console.log('Running migrations...');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    await initDatabase(pool);
    console.log('Migrations completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await closeDatabase();
    await pool.end();
  }
}

main();
