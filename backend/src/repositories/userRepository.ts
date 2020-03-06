import { getDatabase } from '../database';
import { User, UserPublic, JwtPayload } from '../types';
import { v4 as uuidv4 } from 'uuid';
import argon2 from 'argon2';
import { logger } from '../utils/logger';

const db = getDatabase();

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

export const userRepository = {
  async create(name: string, email: string, password: string): Promise<UserPublic> {
    const id = uuidv4();
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });

    const avatarColors = [
      '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
      '#f97316', '#eab308', '#22c55e', '#14b8a6',
      '#06b6d4', '#3b82f6', '#a855f7', '#d946ef',
    ];
    const avatarColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];

    const stmt = db.prepare(`
      INSERT INTO users (id, name, email, password_hash, avatar_color)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(id, name, email.toLowerCase(), passwordHash, avatarColor);

    const user = db.prepare(`SELECT ${selectUserPublic} FROM users WHERE id = ?`).get(id) as any;
    logger.info(`User created: ${email}`);
    return rowToUserPublic(user);
  },

  async findByEmail(email: string): Promise<User | null> {
    const row = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email.toLowerCase()) as any;
    return row ? rowToUser(row) : null;
  },

  async findById(id: string): Promise<UserPublic | null> {
    const row = db.prepare(`SELECT ${selectUserPublic} FROM users WHERE id = ?`).get(id) as any;
    return row ? rowToUserPublic(row) : null;
  },

  async findByIdWithPassword(id: string): Promise<User | null> {
    const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as any;
    return row ? rowToUser(row) : null;
  },

  async verifyPassword(user: User, password: string): Promise<boolean> {
    return argon2.verify(user.passwordHash, password);
  },

  async updateName(id: string, name: string): Promise<UserPublic | null> {
    const stmt = db.prepare(`UPDATE users SET name = ? WHERE id = ?`);
    const result = stmt.run(name, id);
    if (result.changes === 0) return null;
    return this.findById(id);
  },

  async updateEmail(id: string, email: string): Promise<UserPublic | null> {
    const stmt = db.prepare(`UPDATE users SET email = ? WHERE id = ?`);
    const result = stmt.run(email.toLowerCase(), id);
    if (result.changes === 0) return null;
    return this.findById(id);
  },

  async updatePassword(id: string, newPassword: string): Promise<boolean> {
    const passwordHash = await argon2.hash(newPassword, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16,
      timeCost: 3,
      parallelism: 1,
    });
    const stmt = db.prepare(`UPDATE users SET password_hash = ? WHERE id = ?`);
    const result = stmt.run(passwordHash, id);
    return result.changes > 0;
  },

  async updateAvatarColor(id: string, avatarColor: string): Promise<UserPublic | null> {
    const stmt = db.prepare(`UPDATE users SET avatar_color = ? WHERE id = ?`);
    const result = stmt.run(avatarColor, id);
    if (result.changes === 0) return null;
    return this.findById(id);
  },

  async delete(id: string): Promise<boolean> {
    const stmt = db.prepare(`DELETE FROM users WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  },

  async createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, userId, tokenHash, expiresAt.toISOString());
  },

  async findSession(tokenHash: string): Promise<{ userId: string; expiresAt: Date } | null> {
    const row = db.prepare(`
      SELECT user_id as userId, expires_at as expiresAt FROM sessions WHERE token_hash = ?
    `).get(tokenHash) as any;
    if (!row) return null;
    return { userId: row.userId, expiresAt: new Date(row.expiresAt) };
  },

  async deleteSession(tokenHash: string): Promise<boolean> {
    const stmt = db.prepare(`DELETE FROM sessions WHERE token_hash = ?`);
    const result = stmt.run(tokenHash);
    return result.changes > 0;
  },

  async deleteUserSessions(userId: string): Promise<void> {
    const stmt = db.prepare(`DELETE FROM sessions WHERE user_id = ?`);
    stmt.run(userId);
  },

  async deleteExpiredSessions(): Promise<void> {
    const stmt = db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`);
    stmt.run();
  },
};