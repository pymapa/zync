/**
 * In-memory session store
 * Sessions expire after 30 days of inactivity
 * Used for local development when DATABASE_URL is not set
 */

import { generateSessionId } from '../../utils/crypto';
import { logger } from '../../utils/logger';
import type { ISessionStore, Session, SessionUser } from './interface';

export class SessionStore implements ISessionStore {
  private sessions: Map<string, Session>;
  private userSessions: Map<number, Set<string>>; // userId -> Set of sessionIds
  private readonly maxAge: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(maxAgeMs: number) {
    this.sessions = new Map();
    this.userSessions = new Map();
    this.maxAge = maxAgeMs;
  }

  async init(): Promise<void> {
    // Cleanup expired sessions every 10 minutes
    this.cleanupInterval = setInterval(() => this.cleanupExpiredSessions(), 10 * 60 * 1000);
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

    const session: Session = {
      id: sessionId,
      userId,
      accessToken,
      refreshToken,
      tokenExpiresAt,
      user,
      createdAt: now,
      lastAccessedAt: now,
    };

    this.sessions.set(sessionId, session);

    // Track session by user ID
    const userSessionSet = this.userSessions.get(userId) || new Set();
    userSessionSet.add(sessionId);
    this.userSessions.set(userId, userSessionSet);

    logger.info('Session created', { sessionId, userId });

    return session;
  }

  async get(sessionId: string): Promise<Session | undefined> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return undefined;
    }

    // Check if session expired
    const now = Date.now();
    if (now - session.lastAccessedAt > this.maxAge) {
      await this.destroy(sessionId);
      return undefined;
    }

    // Update last accessed time
    session.lastAccessedAt = now;

    return session;
  }

  async updateTokens(
    sessionId: string,
    accessToken: string,
    refreshToken: string,
    tokenExpiresAt: number
  ): Promise<boolean> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return false;
    }

    session.accessToken = accessToken;
    session.refreshToken = refreshToken;
    session.tokenExpiresAt = tokenExpiresAt;
    session.lastAccessedAt = Date.now();

    logger.info('Session tokens updated', { sessionId, userId: session.userId });

    return true;
  }

  async destroy(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return false;
    }

    this.sessions.delete(sessionId);

    // Remove from user sessions tracking
    const userSessionSet = this.userSessions.get(session.userId);
    if (userSessionSet) {
      userSessionSet.delete(sessionId);
      if (userSessionSet.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    logger.info('Session destroyed', { sessionId, userId: session.userId });

    return true;
  }

  async getByUserId(userId: number): Promise<Session | undefined> {
    const userSessionSet = this.userSessions.get(userId);
    if (!userSessionSet || userSessionSet.size === 0) {
      return undefined;
    }
    // Return the first active session
    for (const sessionId of userSessionSet) {
      const session = this.sessions.get(sessionId);
      if (session) {
        return session;
      }
    }
    return undefined;
  }

  async destroyUserSessions(userId: number): Promise<number> {
    const userSessionSet = this.userSessions.get(userId);

    if (!userSessionSet) {
      return 0;
    }

    let destroyedCount = 0;

    for (const sessionId of userSessionSet) {
      if (this.sessions.delete(sessionId)) {
        destroyedCount++;
      }
    }

    this.userSessions.delete(userId);

    logger.info('All user sessions destroyed', { userId, destroyedCount });

    return destroyedCount;
  }

  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastAccessedAt > this.maxAge) {
        // Sync destroy to avoid async in setInterval
        this.sessions.delete(sessionId);
        const userSessionSet = this.userSessions.get(session.userId);
        if (userSessionSet) {
          userSessionSet.delete(sessionId);
          if (userSessionSet.size === 0) {
            this.userSessions.delete(session.userId);
          }
        }
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.info('Expired sessions cleaned up', { cleanedCount });
    }
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
    this.userSessions.clear();
    logger.info('Session store shutdown complete');
  }
}
