import { IRagEvent } from '@domain/_interfaces/aiAssistant.interface';
import { IAiAgentService, RagStreamInput } from '@domain/_repositories/aiAgentService.repository';

// Canned SSE for E2E (config.mockAi → D18). No aiagent/Qdrant/LLM contacted.
// Mirrors the real wire shapes so the frontend path is identical.

// Off-corpus queries → empty retrieval (AC-001.4).
const OFF_CORPUS = /weather|stock price|football|recipe|joke/i;

const ANSWER: Record<string, string> = {
  en: 'API keys are created in Settings → API keys, and the secret is shown once.',
  es: 'Las claves de API se crean en Ajustes → Claves de API, y el secreto se muestra una vez.',
};

const mockAiAgentService: IAiAgentService = {
  async *streamRag(input: RagStreamInput): AsyncIterable<IRagEvent> {
    await Promise.resolve(); // satisfy async-generator contract; mock is synchronous
    if (OFF_CORPUS.test(input.query)) {
      yield { empty: true, sources: [] };
      return;
    }
    const answer = ANSWER[input.locale] ?? ANSWER.en;
    for (const token of answer.match(/\S+\s*/g) ?? [answer]) {
      yield { delta: token };
    }
    yield {
      sources: [
        {
          documentName: 'spec-api-automation.md',
          documentId: 'spec-api-automation',
          excerpt: 'Bearer API keys for headless integrations are created in Settings.',
          score: 0.91,
        },
      ],
    };
  },

  health(): Promise<boolean> {
    return Promise.resolve(true);
  },
};

export default mockAiAgentService;
