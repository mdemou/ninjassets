import { IRagEvent } from '@domain/_interfaces/aiAssistant.interface';
import { IAiAgentService, RagStreamInput } from '@domain/_repositories/aiAgentService.repository';
import config from '@config/config';
import logger from '@services/logger.service';

/** Parse an aiagent SSE byte stream into RAG events (§9.5). */
async function* parseSse(body: AsyncIterable<Uint8Array>): AsyncIterable<IRagEvent> {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of body) {
    buffer += decoder.decode(chunk, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
      if (!dataLine) continue;
      const data = dataLine.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        yield JSON.parse(data) as IRagEvent;
      } catch {
        /* ignore malformed frame */
      }
    }
  }
}

const httpAiAgentService: IAiAgentService = {
  async *streamRag(input: RagStreamInput): AsyncIterable<IRagEvent> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.ai.agentTimeoutMs);
    try {
      const res = await fetch(`${config.ai.agentUrl}/chat/rag`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-key': config.ai.agentApiKey,
        },
        body: JSON.stringify({
          query: input.query,
          locale: input.locale,
          top_k: input.topK,
          history: input.history,
        }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        logger.error(__filename, 'streamRag', `aiagent responded ${res.status}`, null);
        yield { error: `aiagent_status_${res.status}` };
        return;
      }
      yield* parseSse(res.body as AsyncIterable<Uint8Array>);
    } catch (error) {
      logger.error(__filename, 'streamRag', 'aiagent stream failed', error);
      yield { error: 'aiagent_unreachable' };
    } finally {
      clearTimeout(timeout);
    }
  },

  async health(): Promise<boolean> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(`${config.ai.agentUrl}/health`, { signal: controller.signal });
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
    }
  },
};

export default httpAiAgentService;
