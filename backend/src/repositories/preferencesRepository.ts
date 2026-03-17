import { getDatabase } from '../database';
import { UserPreferences, Theme } from '../types';
import { logger } from '../utils/logger';

const db = getDatabase();

const defaultPreferences: Omit<UserPreferences, 'userId'> = {
  theme: 'system',
  sidebarCollapsed: false,
  enterToSend: true,
  showTimestamps: true,
  autoScroll: true,
  model: 'qwen2.5:3b',
  temperature: 0.7,
  systemPrompt: '',
};

function rowToPreferences(row: any): UserPreferences {
  return {
    theme: row.theme as Theme,
    sidebarCollapsed: Boolean(row.sidebar_collapsed),
    enterToSend: Boolean(row.enter_to_send),
    showTimestamps: Boolean(row.show_timestamps),
    autoScroll: Boolean(row.auto_scroll),
    model: row.model,
    temperature: row.temperature,
    systemPrompt: row.system_prompt || '',
  };
}

export const preferencesRepository = {
  async get(userId: string): Promise<UserPreferences> {
    const row = db.prepare(`SELECT * FROM user_preferences WHERE user_id = ?`).get(userId) as any;
    if (row) {
      return rowToPreferences(row);
    }
    // Create default preferences
    return this.create(userId);
  },

  async create(userId: string): Promise<UserPreferences> {
    const stmt = db.prepare(`
      INSERT INTO user_preferences (user_id, theme, sidebar_collapsed, enter_to_send, show_timestamps, auto_scroll, model, temperature, system_prompt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      userId,
      defaultPreferences.theme,
      defaultPreferences.sidebarCollapsed ? 1 : 0,
      defaultPreferences.enterToSend ? 1 : 0,
      defaultPreferences.showTimestamps ? 1 : 0,
      defaultPreferences.autoScroll ? 1 : 0,
      defaultPreferences.model,
      defaultPreferences.temperature,
      defaultPreferences.systemPrompt
    );

    const row = db.prepare(`SELECT * FROM user_preferences WHERE user_id = ?`).get(userId) as any;
    logger.info(`Default preferences created for user: ${userId}`);
    return rowToPreferences(row);
  },

  async update(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences> {
    const current = await this.get(userId);
    const merged = { ...current, ...updates };

    const stmt = db.prepare(`
      UPDATE user_preferences
      SET theme = ?, sidebar_collapsed = ?, enter_to_send = ?, show_timestamps = ?, auto_scroll = ?, model = ?, temperature = ?, system_prompt = ?
      WHERE user_id = ?
    `);
    stmt.run(
      merged.theme,
      merged.sidebarCollapsed ? 1 : 0,
      merged.enterToSend ? 1 : 0,
      merged.showTimestamps ? 1 : 0,
      merged.autoScroll ? 1 : 0,
      merged.model,
      merged.temperature,
      merged.systemPrompt,
      userId
    );

    return merged;
  },

  async setTheme(userId: string, theme: Theme): Promise<UserPreferences> {
    return this.update(userId, { theme });
  },

  async setSidebarCollapsed(userId: string, collapsed: boolean): Promise<UserPreferences> {
    return this.update(userId, { sidebarCollapsed: collapsed });
  },

  async setModel(userId: string, model: string): Promise<UserPreferences> {
    return this.update(userId, { model });
  },

  async setTemperature(userId: string, temperature: number): Promise<UserPreferences> {
    return this.update(userId, { temperature });
  },

  async setSystemPrompt(userId: string, systemPrompt: string): Promise<UserPreferences> {
    return this.update(userId, { systemPrompt });
  },
};