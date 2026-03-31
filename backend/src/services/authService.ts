import { userRepository } from '../repositories/userRepository';
import { preferencesRepository } from '../repositories/preferencesRepository';
import { JwtPayload, UserPublic, UserPreferences } from '../types';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { logger } from '../utils/logger';

const JWT_SECRET = process.env.SESSION_SECRET || 'auron-ai-dev-secret-change-in-production';
const TOKEN_EXPIRY_DAYS = 30;

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function createTokenPayload(userId: string, email: string): JwtPayload {
  return {
    userId,
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + TOKEN_EXPIRY_DAYS * 24 * 60 * 60,
  };
}

function encodePayload(payload: JwtPayload): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payloadStr = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payloadStr}`)
    .digest('base64url');
  return `${header}.${payloadStr}.${signature}`;
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as JwtPayload;

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${parts[0]}.${parts[1]}`)
      .digest('base64url');

    if (parts[2] !== expectedSignature) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export const authService = {
  async signup(name: string, email: string, password: string): Promise<{ user: UserPublic; token: string }> {
    // Validate input
    if (!name || !name.trim()) {
      throw new Error('Name is required');
    }
    if (!email || !email.includes('@')) {
      throw new Error('Valid email is required');
    }
    if (!password || password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Check if user exists
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new Error('An account with this email already exists');
    }

    // Create user
    const user = await userRepository.create(name.trim(), email.toLowerCase().trim(), password);

    // Create default preferences
    await preferencesRepository.create(user.id);

    // Create session token
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    await userRepository.createSession(user.id, tokenHash, expiresAt);

    logger.info(`User signed up: ${email}`);
    return { user, token };
  },

  async login(email: string, password: string): Promise<{ user: UserPublic; token: string }> {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    const user = await userRepository.findByEmail(email);
    if (!user) {
      // Use same error to avoid user enumeration
      throw new Error('Invalid email or password');
    }

    const valid = await userRepository.verifyPassword(user, password);
    if (!valid) {
      throw new Error('Invalid email or password');
    }

    const userPublic = await userRepository.findById(user.id);
    if (!userPublic) {
      throw new Error('User not found');
    }

    // Create session token
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    await userRepository.createSession(user.id, tokenHash, expiresAt);

    // Ensure preferences exist
    await preferencesRepository.get(user.id);

    logger.info(`User logged in: ${email}`);
    return { user: userPublic, token };
  },

  async logout(token: string): Promise<void> {
    const tokenHash = hashToken(token);
    await userRepository.deleteSession(tokenHash);
  },

  async logoutAll(userId: string): Promise<void> {
    await userRepository.deleteUserSessions(userId);
  },

  async validateToken(token: string): Promise<UserPublic | null> {
    const tokenHash = hashToken(token);
    const session = await userRepository.findSession(tokenHash);
    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    return userRepository.findById(session.userId);
  },

  async getUserFromToken(token: string): Promise<UserPublic | null> {
    return this.validateToken(token);
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    const user = await userRepository.findByIdWithPassword(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const valid = await userRepository.verifyPassword(user, currentPassword);
    if (!valid) {
      throw new Error('Current password is incorrect');
    }

    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters');
    }

    await userRepository.updatePassword(userId, newPassword);

    // Invalidate all existing sessions
    await userRepository.deleteUserSessions(userId);

    logger.info(`Password changed for user: ${userId}`);
    return true;
  },

  async updateProfile(userId: string, updates: { name?: string; email?: string }): Promise<UserPublic | null> {
    if (updates.name !== undefined) {
      if (!updates.name.trim()) {
        throw new Error('Name cannot be empty');
      }
      if (updates.name.length > 100) {
        throw new Error('Name is too long');
      }
      return userRepository.updateName(userId, updates.name.trim());
    }

    if (updates.email !== undefined) {
      if (!updates.email.includes('@')) {
        throw new Error('Valid email is required');
      }
      const existing = await userRepository.findByEmail(updates.email);
      if (existing && existing.id !== userId) {
        throw new Error('Email already in use');
      }
      return userRepository.updateEmail(userId, updates.email.toLowerCase().trim());
    }

    return userRepository.findById(userId);
  },

  async updatePreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences> {
    return preferencesRepository.update(userId, preferences);
  },

  async getPreferences(userId: string): Promise<UserPreferences> {
    return preferencesRepository.get(userId);
  },

  async deleteAccount(userId: string, password: string): Promise<boolean> {
    const user = await userRepository.findByIdWithPassword(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const valid = await userRepository.verifyPassword(user, password);
    if (!valid) {
      throw new Error('Password is incorrect');
    }

    // Delete all sessions
    await userRepository.deleteUserSessions(userId);

    // Delete user (cascades to conversations, messages, preferences)
    const deleted = await userRepository.delete(userId);

    logger.info(`Account deleted: ${userId}`);
    return deleted;
  },

  // Utility for cleaning up expired sessions
  async cleanupExpiredSessions(): Promise<void> {
    await userRepository.deleteExpiredSessions();
  },
};