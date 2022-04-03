import { userRepository } from '../repositories/userRepository';
import { preferencesRepository } from '../repositories/preferencesRepository';
import { UserPublic, UserPreferences, SessionInfo } from '../types';
import { getDatabase, withTransaction } from '../database';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { config } from '../config';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'AUTH_ERROR'
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/** Opaque, cryptographically random session token. */
function generateToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function validateEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_REGEX.test(email);
}

export const authService = {
  async signup(name: string, email: string, password: string): Promise<{ user: UserPublic; token: string }> {
    if (!name || !name.trim()) {
      throw new AuthError('Name is required', 'VALIDATION_ERROR');
    }
    if (name.trim().length > 100) {
      throw new AuthError('Name is too long', 'VALIDATION_ERROR');
    }
    if (!email || !validateEmail(email)) {
      throw new AuthError('A valid email address is required', 'VALIDATION_ERROR');
    }
    if (!password || password.length < config.auth.passwordMinLength) {
      throw new AuthError(
        `Password must be at least ${config.auth.passwordMinLength} characters`,
        'VALIDATION_ERROR'
      );
    }
    if (password.length > config.auth.passwordMaxLength) {
      throw new AuthError('Password is too long', 'VALIDATION_ERROR');
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await userRepository.findByEmail(normalizedEmail);
    if (existing) {
      throw new AuthError('An account with this email already exists', 'EMAIL_TAKEN');
    }

    // User and default preferences are created atomically: a failure must not
    // leave a partial account behind.
    const user = await withTransaction(async () => {
      const created = await userRepository.create(name.trim(), normalizedEmail, password);
      await preferencesRepository.create(created.id);
      return created;
    });

    const token = await this.createSessionForUser(user.id);
    logger.info(`User signed up: ${user.id}`);
    return { user, token };
  },

  async createSessionForUser(userId: string): Promise<string> {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + config.auth.tokenExpiryDays * 24 * 60 * 60 * 1000);
    await userRepository.createSession(userId, tokenHash, expiresAt);
    return token;
  },

  async login(email: string, password: string): Promise<{ user: UserPublic; token: string }> {
    if (!email || !password) {
      throw new AuthError('Email and password are required', 'VALIDATION_ERROR');
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      // Burn equivalent CPU time so response timing does not reveal
      // whether an account exists.
      await userRepository.verifyDummyPassword(password);
      throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const valid = await userRepository.verifyPassword(user, password);
    if (!valid) {
      throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const userPublic = await userRepository.findById(user.id);
    if (!userPublic) {
      throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const token = await this.createSessionForUser(user.id);
    await preferencesRepository.get(user.id); // ensure defaults exist

    logger.info(`User logged in: ${user.id}`);
    return { user: userPublic, token };
  },

  async logout(token: string): Promise<void> {
    await userRepository.deleteSession(hashToken(token));
  },

  async logoutAll(userId: string): Promise<void> {
    await userRepository.deleteUserSessions(userId);
  },

  async validateToken(token: string): Promise<UserPublic | null> {
    if (!token) return null;
    const tokenHash = hashToken(token);
    const session = await userRepository.findSession(tokenHash);
    if (!session || session.expiresAt.getTime() < Date.now()) {
      return null;
    }
    return userRepository.findById(session.userId);
  },

  async listSessions(userId: string, currentToken: string | undefined): Promise<SessionInfo[]> {
    const sessions = await userRepository.listSessions(userId);
    if (!currentToken) return sessions;
    const currentHash = hashToken(currentToken);
    const currentRow = getDatabase()
      .prepare(`SELECT id FROM sessions WHERE token_hash = ?`)
      .get(currentHash) as { id: string } | undefined;
    if (!currentRow) return sessions;
    return sessions.map((s) => ({ ...s, isCurrent: s.id === currentRow.id }));
  },

  async revokeSession(userId: string, sessionId: string): Promise<boolean> {
    return userRepository.deleteSessionById(userId, sessionId);
  },

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await userRepository.findByIdWithPassword(userId);
    if (!user) {
      throw new AuthError('User not found', 'NOT_FOUND');
    }

    const valid = await userRepository.verifyPassword(user, currentPassword);
    if (!valid) {
      throw new AuthError('Current password is incorrect', 'INVALID_CREDENTIALS');
    }

    if (
      newPassword.length < config.auth.passwordMinLength ||
      newPassword.length > config.auth.passwordMaxLength
    ) {
      throw new AuthError(
        `New password must be between ${config.auth.passwordMinLength} and ${config.auth.passwordMaxLength} characters`,
        'VALIDATION_ERROR'
      );
    }

    if (newPassword === currentPassword) {
      throw new AuthError('New password must be different from the current password', 'VALIDATION_ERROR');
    }

    await userRepository.updatePassword(userId, newPassword);
    // Invalidate every session, including the current one.
    await userRepository.deleteUserSessions(userId);
    logger.info(`Password changed for user: ${userId}`);
  },

  async updateProfile(
    userId: string,
    updates: { name?: string; email?: string }
  ): Promise<UserPublic> {
    const normalized: { name?: string; email?: string } = {};

    if (updates.name !== undefined) {
      const name = updates.name.trim();
      if (!name) {
        throw new AuthError('Name cannot be empty', 'VALIDATION_ERROR');
      }
      if (name.length > 100) {
        throw new AuthError('Name is too long', 'VALIDATION_ERROR');
      }
      normalized.name = name;
    }

    if (updates.email !== undefined) {
      const email = updates.email.toLowerCase().trim();
      if (!validateEmail(email)) {
        throw new AuthError('A valid email address is required', 'VALIDATION_ERROR');
      }
      const existing = await userRepository.findByEmail(email);
      if (existing && existing.id !== userId) {
        throw new AuthError('Email already in use', 'EMAIL_TAKEN');
      }
      normalized.email = email;
    }

    if (Object.keys(normalized).length === 0) {
      const user = await userRepository.findById(userId);
      if (!user) throw new AuthError('User not found', 'NOT_FOUND');
      return user;
    }

    const updated = await userRepository.updateProfileFields(userId, normalized);
    if (!updated) {
      throw new AuthError('User not found', 'NOT_FOUND');
    }
    return updated;
  },

  async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    return preferencesRepository.update(userId, preferences);
  },

  async getPreferences(userId: string): Promise<UserPreferences> {
    return preferencesRepository.get(userId);
  },

  async deleteAccount(userId: string, password: string): Promise<void> {
    const user = await userRepository.findByIdWithPassword(userId);
    if (!user) {
      throw new AuthError('User not found', 'NOT_FOUND');
    }

    const valid = await userRepository.verifyPassword(user, password);
    if (!valid) {
      throw new AuthError('Password is incorrect', 'INVALID_CREDENTIALS');
    }

    await withTransaction(async () => {
      await userRepository.deleteUserSessions(userId);
      await preferencesRepository.delete(userId);
      await userRepository.delete(userId); // cascades to conversations and messages
    });

    logger.info(`Account deleted: ${userId}`);
  },

  async cleanupExpiredSessions(): Promise<void> {
    await userRepository.deleteExpiredSessions();
  },
};
