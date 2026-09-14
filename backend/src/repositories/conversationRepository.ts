import { getDatabase } from '../database';
import {
  Conversation,
  ConversationWithMessageCount,
  Message,
  PaginatedResponse,
  SearchResult,
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const db = getDatabase();

function rowToConversation(row: any): Conversation {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToConversationWithCount(row: any): ConversationWithMessageCount {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    pinned: Boolean(row.pinned),
    archived: Boolean(row.archived),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: row.message_count,
    lastMessageAt: row.last_message_at,
    lastMessagePreview: row.last_message_preview,
  };
}

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

export const conversationRepository = {
  async create(userId: string, title: string = 'New Chat'): Promise<Conversation> {
    const id = uuidv4();
    const stmt = db.prepare(`
      INSERT INTO conversations (id, user_id, title)
      VALUES (?, ?, ?)
    `);
    stmt.run(id, userId, title);
    const row = db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(id) as any;
    logger.info(`Conversation created: ${id} for user ${userId}`);
    return rowToConversation(row);
  },

  async findById(id: string, userId: string): Promise<Conversation | null> {
    const row = db.prepare(`SELECT * FROM conversations WHERE id = ? AND user_id = ?`).get(id, userId) as any;
    return row ? rowToConversation(row) : null;
  },

  async findByIdWithMessages(id: string, userId: string): Promise<{ conversation: Conversation; messages: Message[] } | null> {
    const conversation = await this.findById(id, userId);
    if (!conversation) return null;

    const messages = db.prepare(`
      SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC
    `).all(id) as any[];

    return {
      conversation,
      messages: messages.map(rowToMessage),
    };
  },

  async list(userId: string, options?: { includeArchived?: boolean; pinnedOnly?: boolean; limit?: number; offset?: number }): Promise<ConversationWithMessageCount[]> {
    let query = `
      SELECT
        c.*,
        COUNT(m.id) as message_count,
        MAX(m.created_at) as last_message_at,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_preview
      FROM conversations c
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE c.user_id = ?
    `;

    const params: any[] = [userId];

    if (!options?.includeArchived) {
      query += ` AND c.archived = 0`;
    }

    if (options?.pinnedOnly) {
      query += ` AND c.pinned = 1`;
    }

    query += ` GROUP BY c.id`;

    if (options?.pinnedOnly) {
      query += ` ORDER BY c.pinned DESC, c.updated_at DESC`;
    } else {
      query += ` ORDER BY c.pinned DESC, c.updated_at DESC`;
    }

    if (options?.limit) {
      query += ` LIMIT ?`;
      params.push(options.limit);
    }

    if (options?.offset) {
      query += ` OFFSET ?`;
      params.push(options.offset);
    }

    const rows = db.prepare(query).all(...params) as any[];
    return rows.map(rowToConversationWithCount);
  },

  async listPaginated(
    userId: string,
    page: number = 1,
    pageSize: number = 20,
    includeArchived: boolean = false
  ): Promise<PaginatedResponse<ConversationWithMessageCount>> {
    const offset = (page - 1) * pageSize;

    let countQuery = `SELECT COUNT(*) as total FROM conversations WHERE user_id = ?`;
    const countParams: any[] = [userId];

    if (!includeArchived) {
      countQuery += ` AND archived = 0`;
    }

    const totalRow = db.prepare(countQuery).get(...countParams) as any;
    const total = totalRow?.total || 0;

    const data = await this.list(userId, { includeArchived, limit: pageSize, offset });

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  async search(userId: string, query: string, limit: number = 20): Promise<SearchResult> {
    const searchTerm = `%${query.toLowerCase()}%`;

    const rows = db.prepare(`
      SELECT
        c.*,
        COUNT(m.id) as message_count,
        MAX(m.created_at) as last_message_at,
        (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_preview
      FROM conversations c
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE c.user_id = ? AND c.archived = 0
        AND (LOWER(c.title) LIKE ? OR EXISTS (
          SELECT 1 FROM messages m2 WHERE m2.conversation_id = c.id AND LOWER(m2.content) LIKE ?
        ))
      GROUP BY c.id
      ORDER BY c.pinned DESC, c.updated_at DESC
      LIMIT ?
    `).all(userId, searchTerm, searchTerm, limit) as any[];

    return {
      conversations: rows.map(rowToConversationWithCount),
      total: rows.length,
      query,
    };
  },

  async updateTitle(id: string, userId: string, title: string): Promise<Conversation | null> {
    const stmt = db.prepare(`UPDATE conversations SET title = ? WHERE id = ? AND user_id = ?`);
    const result = stmt.run(title, id, userId);
    if (result.changes === 0) return null;
    return this.findById(id, userId);
  },

  async togglePin(id: string, userId: string): Promise<Conversation | null> {
    const conversation = await this.findById(id, userId);
    if (!conversation) return null;

    const newPinned = conversation.pinned ? 0 : 1;
    const stmt = db.prepare(`UPDATE conversations SET pinned = ? WHERE id = ? AND user_id = ?`);
    const result = stmt.run(newPinned, id, userId);
    if (result.changes === 0) return null;
    return this.findById(id, userId);
  },

  async archive(id: string, userId: string): Promise<Conversation | null> {
    const stmt = db.prepare(`UPDATE conversations SET archived = 1 WHERE id = ? AND user_id = ?`);
    const result = stmt.run(id, userId);
    if (result.changes === 0) return null;
    return this.findById(id, userId);
  },

  async unarchive(id: string, userId: string): Promise<Conversation | null> {
    const stmt = db.prepare(`UPDATE conversations SET archived = 0 WHERE id = ? AND user_id = ?`);
    const result = stmt.run(id, userId);
    if (result.changes === 0) return null;
    return this.findById(id, userId);
  },

  async delete(id: string, userId: string): Promise<boolean> {
    const stmt = db.prepare(`DELETE FROM conversations WHERE id = ? AND user_id = ?`);
    const result = stmt.run(id, userId);
    return result.changes > 0;
  },

  async deleteAll(userId: string): Promise<number> {
    const stmt = db.prepare(`DELETE FROM conversations WHERE user_id = ?`);
    const result = stmt.run(userId);
    return result.changes;
  },

  async getMessageCount(conversationId: string): Promise<number> {
    const row = db.prepare(`SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?`).get(conversationId) as any;
    return row?.count || 0;
  },

  async updateTimestamp(id: string): Promise<void> {
    const stmt = db.prepare(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`);
    stmt.run(id);
  },
};