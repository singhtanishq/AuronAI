import { getDatabase } from '../database';
import { User, UserPublic, SessionInfo } from '../types';
import { v4 as uuidv4 } from 'uuid';
import argon2 from 'argon2';
import { logger } from '../utils/logger';
import { nowIso, parseDbDate } from '../utils/time';

const selectUserPublic = `
  id, name, email, avatar_color as avatarColor, created_at as createdAt
`;

function rowToUserPublic(row: any): UserPublic {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarColor: row.avatarColor,
    createdAt: row.createdAt,
  };
}

function rowToUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    avatarColor: row.avatar_color,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 2 ** 16,
  timeCost: 3,
  parallelism: 1,
} as const;

/**
 * Precomputed hash used to equalize login timing for unknown emails: without
 * it, a missing account returns faster than a wrong password and leaks
 * which emails exist. Computed lazily on first use.
 */
let dummyHashPromise: Promise<string> | null = null;
function getDummyHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = argon2.hash(`auron-dummy-${nowIso()}`, ARGON2_OPTIONS);
  }
  return dummyHashPromise;
}

export const userRepository = {
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  },

  /**
   * Insert a fully-prepared user record. Synchronous so it can run inside a
   * SQLite transaction; password hashing happens before the transaction.
   */
  insertUser(input: {
    name: string;
    email: string;
    passwordHash: string;
  }): UserPublic {
    const id = uuidv4();

    const avatarColors = [
      '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
      '#f97316', '#eab308', '#22c55e', '#14b8a6',
      '#06b6d4', '#3b82f6', '#a855f7', '#d946ef',
    ];
    const avatarColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];
    const timestamp = nowIso();

    getDatabase()
      .prepare(
        `INSERT INTO users (id, name, email, password_hash, avatar_color, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, input.name, input.email.toLowerCase(), input.passwordHash, avatarColor, timestamp, timestamp);

    const user = getDatabase()
      .prepare(`SELECT ${selectUserPublic} FROM users WHERE id = ?`)
      .get(id) as any;
    logger.info(`User created: ${id}`);
    return rowToUserPublic(user);
  },

  async create(name: string, email: string, password: string): Promise<UserPublic> {
    const passwordHash = await argon2.hash(password, ARGON2_OPTIONS);
    return this.insertUser({ name, email, passwordHash });
  },

  async findByEmail(email: string): Promise<User | null> {
    const row = getDatabase()
      .prepare(`SELECT * FROM users WHERE email = ?`)
      .get(email.toLowerCase()) as any;
    return row ? rowToUser(row) : null;
  },

  async findById(id: string): Promise<UserPublic | null> {
    const row = getDatabase()
      .prepare(`SELECT ${selectUserPublic} FROM users WHERE id = ?`)
      .get(id) as any;
    return row ? rowToUserPublic(row) : null;
  },

  async findByIdWithPassword(id: string): Promise<User | null> {
    const row = getDatabase()
      .prepare(`SELECT * FROM users WHERE id = ?`)
      .get(id) as any;
    return row ? rowToUser(row) : null;
  },

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return argon2.verify(user.passwordHash, password);
  },

  /** Constant-work password check for emails that do not exist. */
  async verifyDummyPassword(password: string): Promise<void> {
    await argon2.verify(await getDummyHash(), password);
  },

  async updateProfileFields(
    id: string,
    updates: { name?: string; email?: string }
  ): Promise<UserPublic | null> {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (updates.name !== undefined) {
      sets.push('name = ?');
      params.push(updates.name);
    }
    if (updates.email !== undefined) {
      sets.push('email = ?');
      params.push(updates.email.toLowerCase());
    }
    if (sets.length === 0) return this.findById(id);

    params.push(id);
    const result = getDatabase()
      .prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`)
      .run(...params);
    if (result.changes === 0) return null;
    return this.findById(id);
  },

  async updatePassword(id: string, newPassword: string): Promise<boolean> {
    const passwordHash = await argon2.hash(newPassword, ARGON2_OPTIONS);
    const result = getDatabase()
      .prepare(`UPDATE users SET password_hash = ? WHERE id = ?`)
      .run(passwordHash, id);
    return result.changes > 0;
  },

  async delete(id: string): Promise<boolean> {
    const result = getDatabase().prepare(`DELETE FROM users WHERE id = ?`).run(id);
    return result.changes > 0;
  },

  async createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const id = uuidv4();
    getDatabase()
      .prepare(
        `INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, userId, tokenHash, expiresAt.toISOString(), nowIso());
  },

  async findSession(tokenHash: string): Promise<{ userId: string; expiresAt: Date } | null> {
    const row = getDatabase()
      .prepare(`SELECT user_id as userId, expires_at as expiresAt FROM sessions WHERE token_hash = ?`)
      .get(tokenHash) as any;
    if (!row) return null;
    return { userId: row.userId, expiresAt: parseDbDate(row.expiresAt) };
  },

  async listSessions(userId: string): Promise<SessionInfo[]> {
    const rows = getDatabase()
      .prepare(
        `SELECT id, created_at as createdAt, expires_at as expiresAt
         FROM sessions WHERE user_id = ? ORDER BY created_at DESC`
      )
      .all(userId) as any[];
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
      isCurrent: false,
    }));
  },

  async deleteSession(tokenHash: string): Promise<boolean> {
    const result = getDatabase().prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
    return result.changes > 0;
  },

  async deleteSessionById(userId: string, sessionId: string): Promise<boolean> {
    const result = getDatabase()
      .prepare(`DELETE FROM sessions WHERE id = ? AND user_id = ?`)
      .run(sessionId, userId);
    return result.changes > 0;
  },

  async deleteUserSessions(userId: string): Promise<void> {
    getDatabase().prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
  },

  async deleteExpiredSessions(): Promise<void> {
    getDatabase().prepare(`DELETE FROM sessions WHERE expires_at < ?`).run(nowIso());
  },
};
