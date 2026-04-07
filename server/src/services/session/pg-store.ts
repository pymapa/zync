/**
 * PostgreSQL-backed session store
 * Sessions are stored in a `sessions` table, surviving restarts and scale-to-zero
 */

import { Pool } from 'pg';
import { generateSessionId } from '../../utils/crypto';
import { logger } from '../../utils/logger';
import type { ISessionStore, Session, SessionUser } from './interface';

interface SessionRow {
  id: string;
  user_id: number;
  access_token: string;
  refresh_token: string;
  token_expires_at: number;
  user_data: SessionUser;
  created_at: number;
  last_accessed_at: number;
}

function mapRowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    userId: row.user_id,
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    tokenExpiresAt: row.token_expires_at,
    user: row.user_data,
    createdAt: row.created_at,
    lastAccessedAt: row.last_accessed_at,
  };
}

export class PostgresSessionStore implements ISessionStore {
  private pool: Pool;
  private readonly maxAge: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(pool: Pool, maxAgeMs: number) {
    this.pool = pool;
    this.maxAge = maxAgeMs;
  }

  async init(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id BIGINT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT NOT NULL,
        token_expires_at BIGINT NOT NULL,
        user_data JSONB NOT NULL,
        created_at BIGINT NOT NULL,
        last_accessed_at BIGINT NOT NULL
      )
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)
    `);

    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_last_accessed_at ON sessions(last_accessed_at)
    `);

    // Cleanup expired sessions every 10 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions().catch(err =>
        logger.error('Session cleanup failed', err)
      );
    }, 10 * 60 * 1000);

    logger.info('PostgreSQL session store initialized');
  }

  async create(
    userId: number,
    accessToken: string,
    refreshToken: string,
    tokenExpiresAt: number,
    user: SessionUser
  ): Promise<Session> {
    const sessionId = generateSessionId();
    const now = Date.now();

    await this.pool.query(
      `INSERT INTO sessions (id, user_id, access_token, refresh_token, token_expires_at, user_data, created_at, last_accessed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [sessionId, userId, accessToken, refreshToken, tokenExpiresAt, JSON.stringify(user), now, now]
    );

    logger.info('Session created', { sessionId, userId });

    return {
      id: sessionId,
      userId,
      accessToken,
      refreshToken,
      tokenExpiresAt,
      user,
      createdAt: now,
      lastAccessedAt: now,
    };
  }

  async get(sessionId: string): Promise<Session | undefined> {
    const now = Date.now();
    const cutoff = now - this.maxAge;

    // Atomically fetch and update lastAccessedAt, only if not expired
    const result = await this.pool.query<SessionRow>(
      `UPDATE sessions
       SET last_accessed_at = $1
       WHERE id = $2 AND last_accessed_at > $3
       RETURNING id, user_id, access_token, refresh_token, token_expires_at, user_data, created_at, last_accessed_at`,
      [now, sessionId, cutoff]
    );

    if (result.rows.length === 0) {
      // Clean up expired session if it exists
      await this.pool.query(
        `DELETE FROM sessions WHERE id = $1 AND last_accessed_at <= $2`,
        [sessionId, cutoff]
      );
      return undefined;
    }

    return mapRowToSession(result.rows[0]!);
  }

  async updateTokens(
    sessionId: string,
    accessToken: string,
    refreshToken: string,
    tokenExpiresAt: number
  ): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE sessions
       SET access_token = $1, refresh_token = $2, token_expires_at = $3, last_accessed_at = $4
       WHERE id = $5`,
      [accessToken, refreshToken, tokenExpiresAt, Date.now(), sessionId]
    );

    if (result.rowCount === 0) {
      return false;
    }

    logger.info('Session tokens updated', { sessionId });

    return true;
  }

  async destroy(sessionId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM sessions WHERE id = $1`,
      [sessionId]
    );

    const destroyed = (result.rowCount ?? 0) > 0;

    if (destroyed) {
      logger.info('Session destroyed', { sessionId });
    }

    return destroyed;
  }

  async getByUserId(userId: number): Promise<Session | undefined> {
    const result = await this.pool.query<SessionRow>(
      `SELECT id, user_id, access_token, refresh_token, token_expires_at, user_data, created_at, last_accessed_at
       FROM sessions
       WHERE user_id = $1 AND last_accessed_at > $2
       ORDER BY last_accessed_at DESC
       LIMIT 1`,
      [userId, Date.now() - this.maxAge]
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    return mapRowToSession(result.rows[0]!);
  }

  async destroyUserSessions(userId: number): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM sessions WHERE user_id = $1`,
      [userId]
    );

    const count = result.rowCount ?? 0;

    if (count > 0) {
      logger.info('All user sessions destroyed', { userId, destroyedCount: count });
    }

    return count;
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const cutoff = Date.now() - this.maxAge;

    const result = await this.pool.query(
      `DELETE FROM sessions WHERE last_accessed_at <= $1`,
      [cutoff]
    );

    const count = result.rowCount ?? 0;
    if (count > 0) {
      logger.info('Expired sessions cleaned up', { cleanedCount: count });
    }
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    // Don't end the pool here — it's shared and managed by the caller
    logger.info('PostgreSQL session store shutdown complete');
  }
}
