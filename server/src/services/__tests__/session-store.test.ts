import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../../utils/logger', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { SessionStore } from '../session/store';
import type { ISessionStore, SessionUser } from '../session/interface';

const TEST_USER: SessionUser = {
  id: 123,
  firstName: 'Test',
  lastName: 'User',
  profileUrl: 'https://example.com/avatar.jpg',
  city: null,
  state: null,
  country: null,
};

const MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

describe('SessionStore (in-memory)', () => {
  let store: ISessionStore;

  beforeEach(async () => {
    store = new SessionStore(MAX_AGE);
    await store.init();
  });

  afterEach(async () => {
    await store.shutdown();
  });

  describe('create', () => {
    it('should create a session with correct fields', async () => {
      const session = await store.create(123, 'access', 'refresh', 9999999, TEST_USER);

      expect(session.id).toBeTypeOf('string');
      expect(session.id.length).toBeGreaterThan(0);
      expect(session.userId).toBe(123);
      expect(session.accessToken).toBe('access');
      expect(session.refreshToken).toBe('refresh');
      expect(session.tokenExpiresAt).toBe(9999999);
      expect(session.user).toEqual(TEST_USER);
      expect(session.createdAt).toBeTypeOf('number');
      expect(session.lastAccessedAt).toBeTypeOf('number');
    });

    it('should generate unique session IDs', async () => {
      const s1 = await store.create(123, 'a', 'r', 999, TEST_USER);
      const s2 = await store.create(123, 'a', 'r', 999, TEST_USER);
      expect(s1.id).not.toBe(s2.id);
    });
  });

  describe('get', () => {
    it('should retrieve a created session', async () => {
      const created = await store.create(123, 'access', 'refresh', 9999999, TEST_USER);
      const retrieved = await store.get(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(created.id);
      expect(retrieved!.userId).toBe(123);
    });

    it('should return undefined for non-existent session', async () => {
      const result = await store.get('nonexistent');
      expect(result).toBeUndefined();
    });

    it('should return undefined for expired session', async () => {
      const shortLivedStore = new SessionStore(100); // 100ms
      await shortLivedStore.init();

      const session = await shortLivedStore.create(123, 'a', 'r', 999, TEST_USER);

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 150));

      const result = await shortLivedStore.get(session.id);
      expect(result).toBeUndefined();

      await shortLivedStore.shutdown();
    });

    it('should update lastAccessedAt on get', async () => {
      const created = await store.create(123, 'access', 'refresh', 9999999, TEST_USER);
      const originalAccess = created.lastAccessedAt;

      await new Promise(resolve => setTimeout(resolve, 10));

      const retrieved = await store.get(created.id);
      expect(retrieved!.lastAccessedAt).toBeGreaterThanOrEqual(originalAccess);
    });
  });

  describe('updateTokens', () => {
    it('should update tokens on existing session', async () => {
      const session = await store.create(123, 'old_access', 'old_refresh', 1000, TEST_USER);

      const updated = await store.updateTokens(session.id, 'new_access', 'new_refresh', 2000);
      expect(updated).toBe(true);

      const retrieved = await store.get(session.id);
      expect(retrieved!.accessToken).toBe('new_access');
      expect(retrieved!.refreshToken).toBe('new_refresh');
      expect(retrieved!.tokenExpiresAt).toBe(2000);
    });

    it('should return false for non-existent session', async () => {
      const result = await store.updateTokens('nonexistent', 'a', 'r', 999);
      expect(result).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should destroy an existing session', async () => {
      const session = await store.create(123, 'a', 'r', 999, TEST_USER);

      const destroyed = await store.destroy(session.id);
      expect(destroyed).toBe(true);

      const retrieved = await store.get(session.id);
      expect(retrieved).toBeUndefined();
    });

    it('should return false for non-existent session', async () => {
      const result = await store.destroy('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getByUserId', () => {
    it('should return a session for existing user', async () => {
      await store.create(123, 'access', 'refresh', 9999999, TEST_USER);

      const session = await store.getByUserId(123);
      expect(session).toBeDefined();
      expect(session!.userId).toBe(123);
    });

    it('should return undefined for non-existent user', async () => {
      const session = await store.getByUserId(999);
      expect(session).toBeUndefined();
    });
  });

  describe('destroyUserSessions', () => {
    it('should destroy all sessions for a user', async () => {
      await store.create(123, 'a1', 'r1', 999, TEST_USER);
      await store.create(123, 'a2', 'r2', 999, TEST_USER);

      const count = await store.destroyUserSessions(123);
      expect(count).toBe(2);

      const session = await store.getByUserId(123);
      expect(session).toBeUndefined();
    });

    it('should return 0 for non-existent user', async () => {
      const count = await store.destroyUserSessions(999);
      expect(count).toBe(0);
    });

    it('should not affect other users', async () => {
      const otherUser: SessionUser = { ...TEST_USER, id: 456 };
      await store.create(123, 'a', 'r', 999, TEST_USER);
      await store.create(456, 'a', 'r', 999, otherUser);

      await store.destroyUserSessions(123);

      const session = await store.getByUserId(456);
      expect(session).toBeDefined();
    });
  });
});
