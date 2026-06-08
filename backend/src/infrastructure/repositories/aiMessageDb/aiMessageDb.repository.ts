import { AiLocale, AiMessageRole, IAiMessage, IAiSource } from '@domain/_interfaces/aiAssistant.interface';
import { AiMessageRepository, CreateMessageRow } from '@domain/_repositories/aiMessage.repository';
import Boom from '@hapi/boom';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';
import aiMessageDbErrors from './aiMessageDb.errors';

interface IAiMessageDB {
  id: string;
  conversation_id: string;
  role: AiMessageRole;
  content: string;
  locale: AiLocale;
  sources: IAiSource[] | null;
  created_at: string;
}

function adapt(row: IAiMessageDB): IAiMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    locale: row.locale,
    sources: row.sources ?? null,
    createdAt: row.created_at,
  };
}

function internal(error: unknown): never {
  logger.error(__filename, 'aiMessageDb', 'error', error);
  throw Boom.badImplementation(aiMessageDbErrors.internalError.message, {
    code: aiMessageDbErrors.internalError.code,
  });
}

const aiMessageDbRepository: AiMessageRepository = {
  async create(data: CreateMessageRow): Promise<IAiMessage> {
    try {
      const [row]: IAiMessageDB[] = await sqlService
        .myDb('ai_message')
        .insert({
          conversation_id: data.conversationId,
          role: data.role,
          content: data.content,
          locale: data.locale,
          // jsonb: serialize explicitly (pg does not auto-stringify arrays).
          sources: data.sources ? JSON.stringify(data.sources) : null,
        })
        .returning('*');
      if (!row) return internal(new Error('insert returned no row'));
      return adapt(row);
    } catch (error) {
      internal(error);
    }
  },

  async listByConversation(conversationId: string): Promise<IAiMessage[]> {
    try {
      const rows: IAiMessageDB[] = await sqlService
        .myDb('ai_message')
        .where({ conversation_id: conversationId })
        .orderBy('created_at', 'asc');
      return rows.map(adapt);
    } catch (error) {
      internal(error);
    }
  },

  async listRecent(conversationId: string, limit: number): Promise<IAiMessage[]> {
    try {
      const rows: IAiMessageDB[] = await sqlService
        .myDb('ai_message')
        .where({ conversation_id: conversationId })
        .orderBy('created_at', 'desc')
        .limit(limit);
      return rows.reverse().map(adapt);
    } catch (error) {
      internal(error);
    }
  },
};

export default aiMessageDbRepository;
