/**
 * Session store interface
 * All methods are async to support both in-memory and database-backed stores
 */

import type { User } from '../../types';

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

export interface ISessionStore {
  /** Initialize the store (create tables, etc.) */
  init(): Promise<void>;

  /** Create a new session */
  create(
    userId: number,
    accessToken: string,
    refreshToken: string,
    tokenExpiresAt: number,
    user: SessionUser
  ): Promise<Session>;

  /** Get session by ID, returns undefined if not found or expired */
  get(sessionId: string): Promise<Session | undefined>;

  /** Update OAuth tokens for a session */
  updateTokens(
    sessionId: string,
    accessToken: string,
    refreshToken: string,
    tokenExpiresAt: number
  ): Promise<boolean>;

  /** Destroy a single session */
  destroy(sessionId: string): Promise<boolean>;

  /** Get the first active session for a user (for background token access) */
  getByUserId(userId: number): Promise<Session | undefined>;

  /** Destroy all sessions for a user */
  destroyUserSessions(userId: number): Promise<number>;

  /** Shutdown the store and cleanup resources */
  shutdown(): Promise<void>;
}
