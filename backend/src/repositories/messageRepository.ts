import { getDatabase } from '../database';
import { Message } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const db = getDatabase();

function rowToMessage(row: any): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    model: row.model,
    status: row.status,
    tokenCount: row.token_count,
    generationTimeMs: row.generation_time_ms,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const messageRepository = {
  async create(
    conversationId: string,
    role: 'user' | 'assistant' | 'system',
    content: string,
    options?: { model?: string; status?: Message['status'] }
  ): Promise<Message> {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, model, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, conversationId, role, content, options?.model || null, options?.status || 'completed');

    const row = db.prepare(`SELECT * FROM messages WHERE id = ?`).get(id) as any;
    return rowToMessage(row);
  },

  async createUserMessage(conversationId: string, content: string): Promise<Message> {
    return this.create(conversationId, 'user', content);
  },

  async createAssistantMessage(
    conversationId: string,
    content: string,
    model: string,
    status: Message['status'] = 'streaming'
  ): Promise<Message> {
    return this.create(conversationId, 'assistant', content, { model, status });
  },

  async createSystemMessage(conversationId: string, content: string): Promise<Message> {
    return this.create(conversationId, 'system', content);
  },

  async findById(id: string): Promise<Message | null> {
    const row = db.prepare(`SELECT * FROM messages WHERE id = ?`).get(id) as any;
    return row ? rowToMessage(row) : null;
  },

  async findByConversationId(conversationId: string): Promise<Message[]> {
    const rows = db.prepare(`
      SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
    `).all(conversationId) as any[];
    return rows.map(rowToMessage);
  },

  async findRecentByConversationId(conversationId: string, limit: number): Promise<Message[]> {
    const rows = db.prepare(`
      SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(conversationId, limit) as any[];
    return rows.map(rowToMessage).reverse();
  },

  async updateContent(id: string, content: string): Promise<Message | null> {
    const stmt = db.prepare(`UPDATE messages SET content = ? WHERE id = ?`);
    const result = stmt.run(content, id);
    if (result.changes === 0) return null;
    return this.findById(id);
  },

  async appendContent(id: string, content: string): Promise<Message | null> {
    const message = await this.findById(id);
    if (!message) return null;
    return this.updateContent(id, message.content + content);
  },

  async updateStatus(id: string, status: Message['status']): Promise<Message | null> {
    const stmt = db.prepare(`UPDATE messages SET status = ? WHERE id = ?`);
    const result = stmt.run(status, id);
    if (result.changes === 0) return null;
    return this.findById(id);
  },

  async updateMetadata(
    id: string,
    metadata: { tokenCount?: number; generationTimeMs?: number; model?: string }
  ): Promise<Message | null> {
    const updates: string[] = [];
    const params: any[] = [];

    if (metadata.tokenCount !== undefined) {
      updates.push('token_count = ?');
      params.push(metadata.tokenCount);
    }
    if (metadata.generationTimeMs !== undefined) {
      updates.push('generation_time_ms = ?');
      params.push(metadata.generationTimeMs);
    }
    if (metadata.model !== undefined) {
      updates.push('model = ?');
      params.push(metadata.model);
    }

    if (updates.length === 0) return this.findById(id);

    params.push(id);
    const stmt = db.prepare(`UPDATE messages SET ${updates.join(', ')} WHERE id = ?`);
    const result = stmt.run(...params);
    if (result.changes === 0) return null;
    return this.findById(id);
  },

  async completeMessage(id: string, metadata?: { tokenCount?: number; generationTimeMs?: number }): Promise<Message | null> {
    const updates = ['status = ?'];
    const params: any[] = ['completed'];

    if (metadata?.tokenCount !== undefined) {
      updates.push('token_count = ?');
      params.push(metadata.tokenCount);
    }
    if (metadata?.generationTimeMs !== undefined) {
      updates.push('generation_time_ms = ?');
      params.push(metadata.generationTimeMs);
    }

    params.push(id);
    const stmt = db.prepare(`UPDATE messages SET ${updates.join(', ')} WHERE id = ?`);
    const result = stmt.run(...params);
    if (result.changes === 0) return null;
    return this.findById(id);
  },

  async abortMessage(id: string): Promise<Message | null> {
    const stmt = db.prepare(`UPDATE messages SET status = ? WHERE id = ?`);
    const result = stmt.run('aborted', id);
    if (result.changes === 0) return null;
    return this.findById(id);
  },

  async delete(id: string): Promise<boolean> {
    const stmt = db.prepare(`DELETE FROM messages WHERE id = ?`);
    const result = stmt.run(id);
    return result.changes > 0;
  },

  async deleteByConversationId(conversationId: string): Promise<number> {
    const stmt = db.prepare(`DELETE FROM messages WHERE conversation_id = ?`);
    const result = stmt.run(conversationId);
    return result.changes;
  },

  async getLastUserMessage(conversationId: string): Promise<Message | null> {
    const row = db.prepare(`
      SELECT * FROM messages
      WHERE conversation_id = ? AND role = 'user'
      ORDER BY created_at DESC LIMIT 1
    `).get(conversationId) as any;
    return row ? rowToMessage(row) : null;
  },

  async countByConversationId(conversationId: string): Promise<number> {
    const row = db.prepare(`SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?`).get(conversationId) as any;
    return row?.count || 0;
  },
};