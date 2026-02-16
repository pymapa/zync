/**
 * Database shell - Interactive connection to SQLite database
 * Run with: npm run db:shell
 */

import path from 'path';
import readline from 'readline';
import { initDatabase, getDatabase, closeDatabase } from '../services/database';

const DB_PATH = path.join(process.cwd(), 'data');

function printHelp() {
  console.log(`
Commands:
  .tables                    List all tables
  .schema [table]            Show table schema
  .count [table]             Count rows in table
  .activities [limit]        Show recent activities (default: 10)
  .sync                      Show sync status
  .stats                     Show database statistics
  .search <query>            Search activities by name
  .sql <query>               Run raw SQL query
  .help                      Show this help
  .exit                      Exit shell
`);
}

function run() {
  console.log('Connecting to database...');
  initDatabase(DB_PATH);
  const db = getDatabase() as any; // Access internal db for raw queries

  // Get the internal better-sqlite3 instance
  const sqlite = db['db'] || db;

  console.log('Connected to:', path.join(DB_PATH, 'zync.db'));
  console.log('Type .help for commands\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'sqlite> ',
  });

  rl.prompt();

  rl.on('line', (line) => {
    const input = line.trim();

    if (!input) {
      rl.prompt();
      return;
    }

    try {
      if (input === '.exit' || input === '.quit') {
        closeDatabase();
        console.log('Bye!');
        process.exit(0);
      }

      if (input === '.help') {
        printHelp();
      } else if (input === '.tables') {
        const tables = sqlite.prepare(`
          SELECT name FROM sqlite_master
          WHERE type='table' AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `).all();
        console.table(tables);
      } else if (input.startsWith('.schema')) {
        const table = input.split(' ')[1];
        if (table) {
          const schema = sqlite.prepare(`
            SELECT sql FROM sqlite_master WHERE name = ?
          `).get(table);
          console.log(schema?.sql || 'Table not found');
        } else {
          const schemas = sqlite.prepare(`
            SELECT name, sql FROM sqlite_master
            WHERE type='table' AND name NOT LIKE 'sqlite_%'
          `).all();
          schemas.forEach((s: any) => {
            console.log(`\n-- ${s.name}`);
            console.log(s.sql);
          });
        }
      } else if (input.startsWith('.count')) {
        const table = input.split(' ')[1] ?? 'activities';
        const result = sqlite.prepare(`SELECT COUNT(*) as count FROM "${table}"`).get() as { count: number };
        console.log(`${table}: ${result.count} rows`);
      } else if (input.startsWith('.activities')) {
        const limit = parseInt(input.split(' ')[1] ?? '10') || 10;
        const activities = sqlite.prepare(`
          SELECT id, name, type,
                 round(distance_meters/1000, 2) as km,
                 round(moving_time_seconds/60, 1) as mins,
                 datetime(start_date/1000, 'unixepoch', 'localtime') as date
          FROM activities
          ORDER BY start_date DESC
          LIMIT ?
        `).all(limit);
        console.table(activities);
      } else if (input === '.sync') {
        const sync = sqlite.prepare('SELECT * FROM sync_status').all();
        console.table(sync);
      } else if (input === '.stats') {
        const stats = {
          activities: sqlite.prepare('SELECT COUNT(*) as c FROM activities').get().c,
          users: sqlite.prepare('SELECT COUNT(*) as c FROM sync_status').get().c,
          types: sqlite.prepare('SELECT type, COUNT(*) as count FROM activities GROUP BY type ORDER BY count DESC').all(),
          dateRange: sqlite.prepare(`
            SELECT
              datetime(MIN(start_date)/1000, 'unixepoch') as oldest,
              datetime(MAX(start_date)/1000, 'unixepoch') as newest
            FROM activities
          `).get(),
        };
        console.log('\n=== Database Stats ===');
        console.log(`Activities: ${stats.activities}`);
        console.log(`Users: ${stats.users}`);
        console.log(`Date range: ${stats.dateRange.oldest} to ${stats.dateRange.newest}`);
        console.log('\nActivities by type:');
        console.table(stats.types);
      } else if (input.startsWith('.search')) {
        const query = input.slice(8).trim();
        if (!query) {
          console.log('Usage: .search <query>');
        } else {
          const results = sqlite.prepare(`
            SELECT id, name, type, datetime(start_date/1000, 'unixepoch', 'localtime') as date
            FROM activities
            WHERE id IN (SELECT rowid FROM activities_fts WHERE activities_fts MATCH ?)
            LIMIT 20
          `).all(query + '*');
          console.table(results);
        }
      } else if (input.startsWith('.sql')) {
        const sql = input.slice(5).trim();
        if (!sql) {
          console.log('Usage: .sql <query>');
        } else {
          const isSelect = sql.toLowerCase().startsWith('select');
          if (isSelect) {
            const results = sqlite.prepare(sql).all();
            console.table(results);
          } else {
            const result = sqlite.prepare(sql).run();
            console.log('Changes:', result.changes);
          }
        }
      } else {
        // Try as raw SQL
        try {
          const isSelect = input.toLowerCase().startsWith('select');
          if (isSelect) {
            const results = sqlite.prepare(input).all();
            console.table(results);
          } else {
            const result = sqlite.prepare(input).run();
            console.log('Changes:', result.changes);
          }
        } catch (e: any) {
          console.error('Error:', e.message);
          console.log('Type .help for commands');
        }
      }
    } catch (e: any) {
      console.error('Error:', e.message);
    }

    rl.prompt();
  });

  rl.on('close', () => {
    closeDatabase();
    console.log('\nBye!');
    process.exit(0);
  });
}

run();
