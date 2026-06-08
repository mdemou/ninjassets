import { IAiConversation } from '@domain/_interfaces/aiAssistant.interface';

export interface CreateConversationRow {
  userId: string;
  title: string;
}

export interface AiConversationRepository {
  create(data: CreateConversationRow): Promise<IAiConversation>;
  /** Non-deleted conversation by id (no owner filter — caller checks ownership). */
  findById(id: string): Promise<IAiConversation | null>;
  /** A given admin's non-deleted conversations, most-recently-updated first. */
  listByUser(userId: string): Promise<IAiConversation[]>;
  touch(id: string): Promise<void>;
  softDelete(id: string): Promise<void>;
}
