// Admin AI assistant domain interfaces (SPEC-AI-ASSISTANT-001 §12).

export type AiLocale = 'en' | 'es';
export type AiMessageRole = 'user' | 'assistant';

/** A retrieved source chunk returned alongside an assistant answer (§10.1). */
export interface IAiSource {
  documentName: string;
  documentId: string;
  excerpt: string;
  score: number;
}

export interface IAiConversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface IAiMessage {
  id: string;
  conversationId: string;
  role: AiMessageRole;
  content: string;
  locale: AiLocale;
  sources: IAiSource[] | null;
  createdAt: string;
}

/** A prior turn passed to the stateless aiagent as LLM context. */
export interface IAiHistoryTurn {
  role: AiMessageRole;
  content: string;
}

/** Wire events streamed from the aiagent `/chat/rag` SSE endpoint (§9.5). */
export type IRagEvent =
  | { delta: string }
  | { empty: true; sources: [] }
  | { sources: IAiSource[] }
  | { error: string };
