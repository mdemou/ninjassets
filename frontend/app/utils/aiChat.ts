import type {
  AiSource,
  ApiResponse,
  GetAiConversationData,
  ListAiConversationsData,
} from '~/types';
import { api } from '~/utils/api';

export interface ChatStreamHandlers {
  onDelta: (text: string) => void;
  onSources: (sources: AiSource[], conversationId: string) => void;
  onEmpty: (conversationId: string) => void;
  onError: (code: string) => void;
}

interface ChatStreamBody {
  message: string;
  conversationId?: string;
  locale: 'en' | 'es';
}

function authToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
}

/**
 * Consume the `/api/p/ai/chat` SSE stream (SPEC-AI-ASSISTANT-001 §9.5).
 * Pre-stream HTTP errors (503/429/400/401) arrive as a JSON body — surfaced via
 * onError with the backend error `code`; the stream itself yields delta/sources/empty.
 */
export async function streamChat(
  body: ChatStreamBody,
  handlers: ChatStreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  const token = authToken();
  const res = await fetch('/api/p/ai/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok || !res.body) {
    let code = `status_${res.status}`;
    try {
      const data = (await res.json()) as ApiResponse;
      if (data.code) code = data.code;
    } catch {
      /* non-JSON error body */
    }
    handlers.onError(code);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const data = dataLine.slice(5).trim();
      if (data === '[DONE]') return;

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(data) as Record<string, unknown>;
      } catch {
        continue;
      }
      if (typeof event.delta === 'string') {
        handlers.onDelta(event.delta);
      } else if (event.empty === true) {
        handlers.onEmpty((event.conversationId as string) ?? '');
      } else if (Array.isArray(event.sources)) {
        handlers.onSources(event.sources as AiSource[], (event.conversationId as string) ?? '');
      } else if (typeof event.error === 'string') {
        handlers.onError(event.error);
      }
    }
  }
}

export const aiApi = {
  listConversations: () => api.get<ListAiConversationsData>('/api/p/ai/conversations'),
  getConversation: (id: string) => api.get<GetAiConversationData>(`/api/p/ai/conversations/${id}`),
  deleteConversation: (id: string) => api.delete(`/api/p/ai/conversations/${id}`),
};
