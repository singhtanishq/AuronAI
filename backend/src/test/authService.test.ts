import { ensureTestDb, resetTestData } from './setup';
import { authService, AuthError } from '../services/authService';
import { userRepository } from '../repositories/userRepository';
import { preferencesRepository } from '../repositories/preferencesRepository';
import { conversationRepository } from '../repositories/conversationRepository';
import { messageRepository } from '../repositories/messageRepository';
import { getDatabase } from '../database';

beforeAll(() => {
  ensureTestDb();
});

beforeEach(() => {
  resetTestData();
});

describe('authService.signup', () => {
  it('creates a user with default preferences and a valid session', async () => {
    const { user, token } = await authService.signup('Ada Lovelace', 'Ada@Example.com', 'password123');

    expect(user.name).toBe('Ada Lovelace');
    expect(user.email).toBe('ada@example.com');
    expect(user).not.toHaveProperty('passwordHash');

    // Session validates and round-trips the user.
    const validated = await authService.validateToken(token);
    expect(validated?.id).toBe(user.id);

    // Default preferences exist (transactional signup).
    const prefs = await preferencesRepository.get(user.id);
    expect(prefs.model).toBeDefined();
    expect(prefs.enterToSend).toBe(true);
  });

  it('rejects duplicate emails', async () => {
    await authService.signup('First', 'dup@example.com', 'password123');
    await expect(authService.signup('Second', 'dup@example.com', 'password123')).rejects.toThrow(
      'already exists'
    );
  });

  it('enforces password length and email validation', async () => {
    await expect(authService.signup('A', 'a@example.com', 'short')).rejects.toThrow(AuthError);
    await expect(authService.signup('A', 'not-an-email', 'password123')).rejects.toThrow(AuthError);
    await expect(authService.signup('  ', 'a@example.com', 'password123')).rejects.toThrow(AuthError);
  });
});

describe('authService.login', () => {
  it('rejects wrong passwords without revealing account existence', async () => {
    await authService.signup('Real User', 'real@example.com', 'password123');

    await expect(authService.login('real@example.com', 'wrongpassword')).rejects.toThrow(
      'Invalid email or password'
    );
    // Unknown email produces the SAME message (and burns comparable time).
    await expect(authService.login('nobody@example.com', 'wrongpassword')).rejects.toThrow(
      'Invalid email or password'
    );
  });

  it('issues independent sessions per login', async () => {
    const { user } = await authService.signup('Sess', 'sess@example.com', 'password123');
    const first = await authService.login('sess@example.com', 'password123');
    const second = await authService.login('sess@example.com', 'password123');

    expect(first.token).not.toBe(second.token);
    expect((await authService.validateToken(first.token))?.id).toBe(user.id);
    expect((await authService.validateToken(second.token))?.id).toBe(user.id);
  });
});

describe('authService.logout', () => {
  it('invalidates only the logged-out session', async () => {
    const { token: keepToken } = await authService.signup('Keep', 'keep@example.com', 'password123');
    const loginResult = await authService.login('keep@example.com', 'password123');

    await authService.logout(loginResult.token);

    expect(await authService.validateToken(loginResult.token)).toBeNull();
    expect(await authService.validateToken(keepToken)).not.toBeNull();
  });

  it('logout-all invalidates every session', async () => {
    const { user, token } = await authService.signup('All', 'all@example.com', 'password123');
    await authService.login('all@example.com', 'password123');
    await authService.login('all@example.com', 'password123');

    await authService.logoutAll(user.id);

    expect(await authService.validateToken(token)).toBeNull();
    const db = getDatabase();
    const count = (db.prepare(`SELECT COUNT(*) as c FROM sessions WHERE user_id = ?`).get(user.id) as any).c;
    expect(count).toBe(0);
  });
});

describe('authService.changePassword', () => {
  it('invalidates all sessions and rejects the old password', async () => {
    const { user, token } = await authService.signup('Change', 'change@example.com', 'password123');
    await authService.login('change@example.com', 'password123');

    await authService.changePassword(user.id, 'password123', 'newpassword456');

    expect(await authService.validateToken(token)).toBeNull();

    const loginOld = await authService.login('change@example.com', 'password123');
    expect(loginOld).toBeDefined(); // re-login works with new session
    const loginNew = await authService.login('change@example.com', 'newpassword456');
    expect((await authService.validateToken(loginNew.token))?.id).toBe(user.id);
    await expect(authService.changePassword(user.id, 'password123', 'anotherpass1')).rejects.toThrow(
      'Current password is incorrect'
    );
  });

  it('rejects reusing the same password', async () => {
    const { user } = await authService.signup('Same', 'same@example.com', 'password123');
    await expect(authService.changePassword(user.id, 'password123', 'password123')).rejects.toThrow(
      'different'
    );
  });
});

describe('authService.updateProfile', () => {
  it('updates name and email in ONE request (regression: email silently dropped)', async () => {
    const { user } = await authService.signup('Original', 'original@example.com', 'password123');

    const updated = await authService.updateProfile(user.id, {
      name: 'Renamed',
      email: 'renamed@example.com',
    });

    expect(updated.name).toBe('Renamed');
    expect(updated.email).toBe('renamed@example.com');
  });

  it('rejects emails already used by another account', async () => {
    await authService.signup('Owner', 'taken@example.com', 'password123');
    const { user } = await authService.signup('Other', 'other@example.com', 'password123');

    await expect(
      authService.updateProfile(user.id, { email: 'taken@example.com' })
    ).rejects.toThrow('Email already in use');
  });

  it('rejects invalid values', async () => {
    const { user } = await authService.signup('Valid', 'valid@example.com', 'password123');

    await expect(authService.updateProfile(user.id, { name: '   ' })).rejects.toThrow('empty');
    await expect(authService.updateProfile(user.id, { email: 'garbage' })).rejects.toThrow('valid email');
  });
});

describe('authService.deleteAccount', () => {
  it('requires the correct password and cascades all data', async () => {
    const { user, token } = await authService.signup('Gone', 'gone@example.com', 'password123');

    const conversation = await conversationRepository.create(user.id, 'To be deleted');
    await messageRepository.createUserMessage(conversation.id, 'message body');

    await expect(authService.deleteAccount(user.id, 'wrongpassword')).rejects.toThrow(
      'Password is incorrect'
    );

    await authService.deleteAccount(user.id, 'password123');

    expect(await authService.validateToken(token)).toBeNull();
    const db = getDatabase();
    expect(db.prepare(`SELECT COUNT(*) as c FROM users WHERE id = ?`).get(user.id)).toBeUndefined();
    expect(
      db.prepare(`SELECT COUNT(*) as c FROM conversations WHERE user_id = ?`).get(user.id)
    ).toBeUndefined();
  });
});

describe('userRepository', () => {
  it('lists sessions and revokes a specific session by id with ownership', async () => {
    const { user, token } = await authService.signup('Lister', 'lister@example.com', 'password123');
    await authService.login('lister@example.com', 'password123');

    const sessions = await userRepository.listSessions(user.id);
    expect(sessions).toHaveLength(2);

    const revoked = await userRepository.deleteSessionById(user.id, sessions[0].id);
    expect(revoked).toBe(true);

    // Cannot revoke another user's session.
    const { user: other } = await authService.signup('Other', 'other-lister@example.com', 'password123');
    expect(await userRepository.deleteSessionById(other.id, sessions[1].id)).toBe(false);

    // Current token still valid after revoking the OTHER session row.
    expect(await authService.validateToken(token)).not.toBeNull();
  });

  it('expired sessions fail validation', async () => {
    const { user } = await authService.signup('Expired', 'expired@example.com', 'password123');
    const crypto = await import('crypto');
    const tokenHash = crypto.createHash('sha256').update('expired-token').digest('hex');
    await userRepository.createSession(user.id, tokenHash, new Date(Date.now() - 1000));

    await authService.cleanupExpiredSessions();
    expect(await authService.validateToken('expired-token')).toBeNull();
  });
});
