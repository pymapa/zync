/**
 * Run database migrations manually
 * Usage: npm run db:migrate
 */

import { initDatabase, closeDatabase } from '../services/database';

console.log('Running migrations...');

try {
  initDatabase();
  console.log('Migrations completed successfully.');
} catch (error) {
  console.error('Migration failed:', error);
  process.exit(1);
} finally {
  closeDatabase();
}
