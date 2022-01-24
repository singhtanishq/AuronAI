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
import { nowIso } from '../utils/time';

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

const CONVERSATION_LIST_SELECT = `
  SELECT
    c.*,
    COUNT(m.id) as message_count,
    MAX(m.created_at) as last_message_at,
    (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC, rowid DESC LIMIT 1) as last_message_preview
  FROM conversations c
  LEFT JOIN messages m ON c.id = m.conversation_id
`;

/** Escape LIKE wildcards so user input is matched literally. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export const conversationRepository = {
  async create(userId: string, title: string = 'New Chat'): Promise<Conversation> {
    const id = uuidv4();
    const timestamp = nowIso();
    getDatabase()
      .prepare(
        `INSERT INTO conversations (id, user_id, title, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, userId, title, timestamp, timestamp);
    const row = getDatabase().prepare(`SELECT * FROM conversations WHERE id = ?`).get(id) as any;
    logger.info(`Conversation created: ${id} for user ${userId}`);
    return rowToConversation(row);
  },

  async findById(id: string, userId: string): Promise<Conversation | null> {
    const row = getDatabase()
      .prepare(`SELECT * FROM conversations WHERE id = ? AND user_id = ?`)
      .get(id, userId) as any;
    return row ? rowToConversation(row) : null;
  },

  async findByIdWithMessages(
    id: string,
    userId: string
  ): Promise<{ conversation: Conversation; messages: Message[] } | null> {
    const conversation = await this.findById(id, userId);
    if (!conversation) return null;

    const messages = getDatabase()
      .prepare(`SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC, rowid ASC`)
      .all(id) as any[];

    return {
      conversation,
      messages: messages.map(rowToMessage),
    };
  },

  async list(
    userId: string,
    options?: { includeArchived?: boolean; pinnedOnly?: boolean; limit?: number; offset?: number }
  ): Promise<ConversationWithMessageCount[]> {
    let query = `${CONVERSATION_LIST_SELECT} WHERE c.user_id = ?`;
    const params: unknown[] = [userId];

    if (!options?.includeArchived) {
      query += ` AND c.archived = 0`;
    }
    if (options?.pinnedOnly) {
      query += ` AND c.pinned = 1`;
    }

    query += ` GROUP BY c.id ORDER BY c.pinned DESC, c.updated_at DESC`;

    if (options?.limit !== undefined) {
      query += ` LIMIT ?`;
      params.push(options.limit);
      if (options.offset !== undefined && options.offset > 0) {
        query += ` OFFSET ?`;
        params.push(options.offset);
      }
    }

    const rows = getDatabase().prepare(query).all(...params) as any[];
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
    const countParams: unknown[] = [userId];
    if (!includeArchived) {
      countQuery += ` AND archived = 0`;
    }

    const totalRow = getDatabase().prepare(countQuery).get(...countParams) as any;
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
    const searchTerm = `%${escapeLike(query.toLowerCase())}%`;

    const rows = getDatabase()
      .prepare(
        `${CONVERSATION_LIST_SELECT}
         WHERE c.user_id = ? AND c.archived = 0
           AND (LOWER(c.title) LIKE ? ESCAPE '\\' OR EXISTS (
             SELECT 1 FROM messages m2 WHERE m2.conversation_id = c.id AND LOWER(m2.content) LIKE ? ESCAPE '\\'
           ))
         GROUP BY c.id
         ORDER BY c.pinned DESC, c.updated_at DESC
         LIMIT ?`
      )
      .all(userId, searchTerm, searchTerm, limit) as any[];

    return {
      conversations: rows.map(rowToConversationWithCount),
      total: rows.length,
      query,
    };
  },

  async updateFields(
    id: string,
    userId: string,
    updates: { title?: string; pinned?: boolean; archived?: boolean }
  ): Promise<Conversation | null> {
    const sets: string[] = [];
    const params: unknown[] = [];

    if (updates.title !== undefined) {
      sets.push('title = ?');
      params.push(updates.title);
    }
    if (updates.pinned !== undefined) {
      sets.push('pinned = ?');
      params.push(updates.pinned ? 1 : 0);
    }
    if (updates.archived !== undefined) {
      sets.push('archived = ?');
      params.push(updates.archived ? 1 : 0);
    }
    if (sets.length === 0) return this.findById(id, userId);

    sets.push(`updated_at = ?`);
    params.push(nowIso());
    params.push(id, userId);

    // The update trigger also refreshes updated_at; writing it explicitly here
    // keeps the field correct even where the trigger is the legacy version.
    const result = getDatabase()
      .prepare(`UPDATE conversations SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`)
      .run(...params);
    if (result.changes === 0) return null;
    return this.findById(id, userId);
  },

  async delete(id: string, userId: string): Promise<boolean> {
    const result = getDatabase()
      .prepare(`DELETE FROM conversations WHERE id = ? AND user_id = ?`)
      .run(id, userId);
    return result.changes > 0;
  },

  async deleteAll(userId: string): Promise<number> {
    const result = getDatabase().prepare(`DELETE FROM conversations WHERE user_id = ?`).run(userId);
    return result.changes;
  },

  async touch(id: string): Promise<void> {
    getDatabase()
      .prepare(`UPDATE conversations SET updated_at = ? WHERE id = ?`)
      .run(nowIso(), id);
  },
};
