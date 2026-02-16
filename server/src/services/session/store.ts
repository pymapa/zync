/**
 * In-memory session store
 * Sessions expire after 30 days of inactivity
 */

import { generateSessionId } from '../../utils/crypto';
import { logger } from '../../utils/logger';
import type { User } from '../../types';

// SessionUser is the User type from our API schema
export type SessionUser = User;

export interface Session {
  id: string;
  userId: number;
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: number;
  user: SessionUser;
  createdAt: number;
  lastAccessedAt: number;
}

interface SessionStoreStats {
  totalSessions: number;
  expiredSessionsRemoved: number;
}

export class SessionStore {
  private sessions: Map<string, Session>;
  private userSessions: Map<number, Set<string>>; // userId -> Set of sessionIds
  private readonly maxAge: number;
  private stats: SessionStoreStats;
  private cleanupInterval: NodeJS.Timeout;

  constructor(maxAgeMs: number) {
    this.sessions = new Map();
    this.userSessions = new Map();
    this.maxAge = maxAgeMs;
    this.stats = {
      totalSessions: 0,
      expiredSessionsRemoved: 0,
    };

    // Cleanup expired sessions every 10 minutes
    this.cleanupInterval = setInterval(() => this.cleanupExpiredSessions(), 10 * 60 * 1000);
  }

  /**
   * Create new session
   */
  create(
    userId: number,
    accessToken: string,
    refreshToken: string,
    tokenExpiresAt: number,
    user: SessionUser
  ): Session {
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

    this.stats.totalSessions = this.sessions.size;

    logger.info('Session created', { sessionId, userId });

    return session;
  }

  /**
   * Get session by ID
   */
  get(sessionId: string): Session | undefined {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return undefined;
    }

    // Check if session expired
    const now = Date.now();
    if (now - session.lastAccessedAt > this.maxAge) {
      this.destroy(sessionId);
      return undefined;
    }

    // Update last accessed time
    session.lastAccessedAt = now;

    return session;
  }

  /**
   * Update session tokens
   */
  updateTokens(
    sessionId: string,
    accessToken: string,
    refreshToken: string,
    tokenExpiresAt: number
  ): boolean {
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

  /**
   * Destroy session
   */
  destroy(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return false;
    }

    // Remove from sessions map
    this.sessions.delete(sessionId);

    // Remove from user sessions tracking
    const userSessionSet = this.userSessions.get(session.userId);
    if (userSessionSet) {
      userSessionSet.delete(sessionId);
      if (userSessionSet.size === 0) {
        this.userSessions.delete(session.userId);
      }
    }

    this.stats.totalSessions = this.sessions.size;

    logger.info('Session destroyed', { sessionId, userId: session.userId });

    return true;
  }

  /**
   * Destroy all sessions for a user
   */
  destroyUserSessions(userId: number): number {
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
    this.stats.totalSessions = this.sessions.size;

    logger.info('All user sessions destroyed', { userId, destroyedCount });

    return destroyedCount;
  }

  /**
   * Remove expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastAccessedAt > this.maxAge) {
        this.destroy(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.stats.expiredSessionsRemoved += cleanedCount;
      logger.info('Expired sessions cleaned up', { cleanedCount });
    }
  }

  /**
   * Get session store statistics
   */
  getStats(): SessionStoreStats {
    return { ...this.stats };
  }

  /**
   * Shutdown session store and cleanup resources
   * MUST be called on application shutdown to clear interval
   */
  shutdown(): void {
    clearInterval(this.cleanupInterval);
    this.sessions.clear();
    this.userSessions.clear();
    logger.info('Session store shutdown complete');
  }
}
