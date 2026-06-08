import { IAiConversation } from '@domain/_interfaces/aiAssistant.interface';
import {
  AiConversationRepository,
  CreateConversationRow,
} from '@domain/_repositories/aiConversation.repository';
import Boom from '@hapi/boom';
import logger from '@services/logger.service';
import sqlService from '@services/sql.service';
import aiConversationDbErrors from './aiConversationDb.errors';

interface IAiConversationDB {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function adapt(row: IAiConversationDB): IAiConversation {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function internal(error: unknown): never {
  logger.error(__filename, 'aiConversationDb', 'error', error);
  throw Boom.badImplementation(aiConversationDbErrors.internalError.message, {
    code: aiConversationDbErrors.internalError.code,
  });
}

const aiConversationDbRepository: AiConversationRepository = {
  async create(data: CreateConversationRow): Promise<IAiConversation> {
    try {
      const [row]: IAiConversationDB[] = await sqlService
        .myDb('ai_conversation')
        .insert({ user_id: data.userId, title: data.title })
        .returning('*');
      if (!row) return internal(new Error('insert returned no row'));
      return adapt(row);
    } catch (error) {
      internal(error);
    }
  },

  async findById(id: string): Promise<IAiConversation | null> {
    try {
      const row: IAiConversationDB | undefined = await sqlService
        .myDb('ai_conversation')
        .where({ id })
        .whereNull('deleted_at')
        .first();
      return row ? adapt(row) : null;
    } catch (error) {
      internal(error);
    }
  },

  async listByUser(userId: string): Promise<IAiConversation[]> {
    try {
      const rows: IAiConversationDB[] = await sqlService
        .myDb('ai_conversation')
        .where({ user_id: userId })
        .whereNull('deleted_at')
        .orderBy('updated_at', 'desc');
      return rows.map(adapt);
    } catch (error) {
      internal(error);
    }
  },

  async touch(id: string): Promise<void> {
    try {
      await sqlService.myDb('ai_conversation').where({ id }).update({ updated_at: sqlService.myDb.fn.now() });
    } catch (error) {
      internal(error);
    }
  },

  async softDelete(id: string): Promise<void> {
    try {
      await sqlService.myDb('ai_conversation').where({ id }).update({ deleted_at: sqlService.myDb.fn.now() });
    } catch (error) {
      internal(error);
    }
  },
};

export default aiConversationDbRepository;
