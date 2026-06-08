import { AiLocale, AiMessageRole, IAiMessage, IAiSource } from '@domain/_interfaces/aiAssistant.interface';

export interface CreateMessageRow {
  conversationId: string;
  role: AiMessageRole;
  content: string;
  locale: AiLocale;
  sources?: IAiSource[] | null;
}

export interface AiMessageRepository {
  create(data: CreateMessageRow): Promise<IAiMessage>;
  /** All messages of a conversation in chronological order. */
  listByConversation(conversationId: string): Promise<IAiMessage[]>;
  /** The most recent N messages, returned chronological (oldest→newest). */
  listRecent(conversationId: string, limit: number): Promise<IAiMessage[]>;
}
