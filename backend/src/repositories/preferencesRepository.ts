import { getDatabase } from '../database';
import { UserPreferences, Theme } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';
import { nowIso } from '../utils/time';

const defaultPreferences: Omit<UserPreferences, 'userId'> = {
  theme: 'system',
  sidebarCollapsed: false,
  enterToSend: true,
  showTimestamps: true,
  autoScroll: true,
  model: config.ollama.defaultModel,
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
    const row = getDatabase()
      .prepare(`SELECT * FROM user_preferences WHERE user_id = ?`)
      .get(userId) as any;
    if (row) return rowToPreferences(row);
    return this.create(userId);
  },

  async create(userId: string): Promise<UserPreferences> {
    const timestamp = nowIso();
    getDatabase()
      .prepare(
        `INSERT INTO user_preferences (
           user_id, theme, sidebar_collapsed, enter_to_send, show_timestamps,
           auto_scroll, model, temperature, system_prompt, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        defaultPreferences.theme,
        defaultPreferences.sidebarCollapsed ? 1 : 0,
        defaultPreferences.enterToSend ? 1 : 0,
        defaultPreferences.showTimestamps ? 1 : 0,
        defaultPreferences.autoScroll ? 1 : 0,
        defaultPreferences.model,
        defaultPreferences.temperature,
        defaultPreferences.systemPrompt,
        timestamp,
        timestamp
      );

    const row = getDatabase()
      .prepare(`SELECT * FROM user_preferences WHERE user_id = ?`)
      .get(userId) as any;
    logger.info(`Default preferences created for user: ${userId}`);
    return rowToPreferences(row);
  },

  async update(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences> {
    const current = await this.get(userId);
    const merged: UserPreferences = { ...current, ...updates };
    const timestamp = nowIso();

    getDatabase()
      .prepare(
        `UPDATE user_preferences
         SET theme = ?, sidebar_collapsed = ?, enter_to_send = ?, show_timestamps = ?, auto_scroll = ?,
             model = ?, temperature = ?, system_prompt = ?, updated_at = ?
         WHERE user_id = ?`
      )
      .run(
        merged.theme,
        merged.sidebarCollapsed ? 1 : 0,
        merged.enterToSend ? 1 : 0,
        merged.showTimestamps ? 1 : 0,
        merged.autoScroll ? 1 : 0,
        merged.model,
        merged.temperature,
        merged.systemPrompt,
        timestamp,
        userId
      );

    return merged;
  },

  async delete(userId: string): Promise<void> {
    getDatabase().prepare(`DELETE FROM user_preferences WHERE user_id = ?`).run(userId);
  },
};
