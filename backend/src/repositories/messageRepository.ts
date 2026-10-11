import { getDatabase } from '../database';
import { Message } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { nowIso } from '../utils/time';

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
    const timestamp = nowIso();
    getDatabase()
      .prepare(
        `INSERT INTO messages (id, conversation_id, role, content, model, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(id, conversationId, role, content, options?.model || null, options?.status || 'completed', timestamp, timestamp);

    const row = getDatabase().prepare(`SELECT * FROM messages WHERE id = ?`).get(id) as any;
    return rowToMessage(row);
  },

  async createUserMessage(conversationId: string, content: string): Promise<Message> {
    return this.create(conversationId, 'user', content, { status: 'completed' });
  },

  async createAssistantMessage(
    conversationId: string,
    model: string,
    status: Message['status'] = 'streaming'
  ): Promise<Message> {
    return this.create(conversationId, 'assistant', '', { model, status });
  },

  async findById(id: string): Promise<Message | null> {
    const row = getDatabase().prepare(`SELECT * FROM messages WHERE id = ?`).get(id) as any;
    return row ? rowToMessage(row) : null;
  },

  async findByConversationId(conversationId: string): Promise<Message[]> {
    const rows = getDatabase()
      .prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC`)
      .all(conversationId) as any[];
    return rows.map(rowToMessage);
  },

  async findRecentByConversationId(conversationId: string, limit: number): Promise<Message[]> {
    // rowid is not projected through SELECT *, so alias it explicitly to keep
    // ordering deterministic when timestamps collide.
    const rows = getDatabase()
      .prepare(
        `SELECT * FROM (
           SELECT rowid AS _ordering_rowid, * FROM messages
           WHERE conversation_id = ?
           ORDER BY created_at DESC, rowid DESC
           LIMIT ?
         ) ORDER BY created_at ASC, _ordering_rowid ASC`
      )
      .all(conversationId, limit) as any[];
    return rows.map(rowToMessage);
  },

  /** Atomically append a delta to a message's content. */
  async appendContent(id: string, delta: string): Promise<void> {
    getDatabase()
      .prepare(`UPDATE messages SET content = content || ?, updated_at = ? WHERE id = ?`)
      .run(delta, nowIso(), id);
  },

  async updateContent(id: string, content: string): Promise<Message | null> {
    const result = getDatabase()
      .prepare(`UPDATE messages SET content = ?, updated_at = ? WHERE id = ?`)
      .run(content, nowIso(), id);
    if (result.changes === 0) return null;
    return this.findById(id);
  },

  async finalize(
    id: string,
    options: {
      status: Message['status'];
      content?: string;
      tokenCount?: number;
      generationTimeMs?: number;
    }
  ): Promise<Message | null> {
    const sets = ['status = ?', 'updated_at = ?'];
    const params: unknown[] = [options.status, nowIso()];

    if (options.content !== undefined) {
      sets.push('content = ?');
      params.push(options.content);
    }
    if (options.tokenCount !== undefined) {
      sets.push('token_count = ?');
      params.push(options.tokenCount);
    }
    if (options.generationTimeMs !== undefined) {
      sets.push('generation_time_ms = ?');
      params.push(options.generationTimeMs);
    }

    params.push(id);
    const result = getDatabase()
      .prepare(`UPDATE messages SET ${sets.join(', ')} WHERE id = ?`)
      .run(...params);
    if (result.changes === 0) return null;
    return this.findById(id);
  },

  async countByConversationId(conversationId: string): Promise<number> {
    const row = getDatabase()
      .prepare(`SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?`)
      .get(conversationId) as any;
    return row?.count || 0;
  },
};
