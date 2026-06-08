import { AiLocale, IAiHistoryTurn, IRagEvent } from '@domain/_interfaces/aiAssistant.interface';

export interface RagStreamInput {
  query: string;
  locale: AiLocale;
  topK: number;
  history: IAiHistoryTurn[];
}

/**
 * Injectable client for the aiagent RAG service. Real impl streams SSE from
 * `POST /chat/rag`; the mock yields canned events for E2E (config.mockAi → D18).
 * The backend never calls the aiagent for anything but this.
 */
export interface IAiAgentService {
  streamRag(input: RagStreamInput): AsyncIterable<IRagEvent>;
  /** Liveness for the health gate (§14.3). */
  health(): Promise<boolean>;
}
