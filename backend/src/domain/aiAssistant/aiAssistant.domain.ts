import config from '@config/config';
import {
  AiLocale,
  IAiConversation,
  IAiHistoryTurn,
  IAiMessage,
  IAiSource,
  IRagEvent,
} from '@domain/_interfaces/aiAssistant.interface';
import { AiConversationRepository } from '@domain/_repositories/aiConversation.repository';
import { IAiAgentService } from '@domain/_repositories/aiAgentService.repository';
import { AiMessageRepository } from '@domain/_repositories/aiMessage.repository';
import Boom from '@hapi/boom';
import redisService from '@services/redis.service';
import aiAssistantErrors from './aiAssistant.errors';

interface AiAssistantRepositories {
  conversationRepository: AiConversationRepository;
  messageRepository: AiMessageRepository;
  aiAgentService: IAiAgentService;
}

export interface ChatInput {
  message: string;
  conversationId?: string;
  locale: AiLocale;
}

// Persisted assistant content for the empty-retrieval case (live UI shows t('ai.noRelevantDocs')).
const NO_RELEVANT_DOCS: Record<AiLocale, string> = {
  en: 'No relevant documentation was found for your question.',
  es: 'No se encontró documentación relevante para tu pregunta.',
};

function aiAssistantDomainFactory(repositories: AiAssistantRepositories) {
  const { conversationRepository, messageRepository, aiAgentService } = repositories;

  function assertEnabled(): void {
    if (!config.ai.enabled && !config.mockAi) {
      throw Boom.serverUnavailable(aiAssistantErrors.disabled.message, {
        code: aiAssistantErrors.disabled.code,
      });
    }
  }

  function normalize(input: ChatInput): { message: string; locale: AiLocale; conversationId?: string } {
    const message = (input.message ?? '').trim();
    if (message.length < config.ai.messageMinLength || message.length > config.ai.messageMaxLength) {
      throw Boom.badRequest(aiAssistantErrors.invalidMessage.message, {
        code: aiAssistantErrors.invalidMessage.code,
      });
    }
    if (input.locale !== 'en' && input.locale !== 'es') {
      throw Boom.badRequest(aiAssistantErrors.invalidLocale.message, {
        code: aiAssistantErrors.invalidLocale.code,
      });
    }
    return { message, locale: input.locale, conversationId: input.conversationId };
  }

  // Fixed-window Redis rate limit: N messages / admin / hour (§13).
  async function enforceRateLimit(userId: string): Promise<void> {
    const bucket = Math.floor(Date.now() / 3_600_000);
    const key = `ai:ratelimit:${userId}:${bucket}`;
    const current = Number(await redisService.get(key)) || 0;
    if (current >= config.ai.rateLimitPerHour) {
      throw Boom.tooManyRequests(aiAssistantErrors.rateLimited.message, {
        code: aiAssistantErrors.rateLimited.code,
      });
    }
    await redisService.set(key, String(current + 1), 3600);
  }

  async function getOwnedConversation(userId: string, id: string): Promise<IAiConversation> {
    const conversation = await conversationRepository.findById(id);
    if (!conversation || conversation.userId !== userId) {
      throw Boom.notFound(aiAssistantErrors.conversationNotFound.message, {
        code: aiAssistantErrors.conversationNotFound.code,
      });
    }
    return conversation;
  }

  async function persistAssistant(
    conversationId: string,
    content: string,
    sources: IAiSource[],
    locale: AiLocale,
  ): Promise<void> {
    await messageRepository.create({ conversationId, role: 'assistant', content, locale, sources });
    await conversationRepository.touch(conversationId);
  }

  // Streams aiagent events, forwards them to the client, accumulates the answer,
  // and persists the assistant turn once the upstream stream completes (§9.5).
  async function* streamAnswer(
    conversationId: string,
    query: string,
    locale: AiLocale,
    history: IAiHistoryTurn[],
  ): AsyncGenerator<IRagEvent & { conversationId?: string }> {
    let answer = '';
    let sources: IAiSource[] = [];
    let empty = false;
    let errored = false;

    for await (const event of aiAgentService.streamRag({
      query,
      locale,
      topK: config.ai.topK,
      history,
    })) {
      if ('delta' in event) {
        answer += event.delta;
        yield { delta: event.delta };
      } else if ('empty' in event) {
        empty = true;
      } else if ('sources' in event) {
        sources = event.sources;
      } else if ('error' in event) {
        errored = true;
        yield { error: event.error };
      }
    }

    if (empty) {
      await persistAssistant(conversationId, NO_RELEVANT_DOCS[locale], [], locale);
      yield { empty: true, sources: [], conversationId };
      return;
    }
    if (errored) {
      if (answer) await persistAssistant(conversationId, answer, sources, locale);
      return; // error event already sent
    }
    await persistAssistant(conversationId, answer, sources, locale);
    yield { sources, conversationId };
  }

  return {
    /**
     * Eager part (feature flag, validation, rate limit, conversation + user-message
     * persistence) runs and may throw an HTTP error BEFORE any streaming. Returns the
     * SSE event generator; the user message has already been saved (history excludes it).
     */
    async beginChat(
      userId: string,
      input: ChatInput,
    ): Promise<AsyncGenerator<IRagEvent & { conversationId?: string }>> {
      assertEnabled();
      const { message, locale, conversationId } = normalize(input);
      await enforceRateLimit(userId);

      const conversation = conversationId
        ? await getOwnedConversation(userId, conversationId)
        : await conversationRepository.create({ userId, title: message.slice(0, 120) });

      // Capture history BEFORE persisting the current user message so it isn't duplicated.
      const history: IAiHistoryTurn[] = (
        await messageRepository.listRecent(conversation.id, config.ai.historyMessages)
      ).map((m) => ({ role: m.role, content: m.content }));
      await messageRepository.create({ conversationId: conversation.id, role: 'user', content: message, locale });

      return streamAnswer(conversation.id, message, locale, history);
    },

    async listConversations(userId: string): Promise<IAiConversation[]> {
      assertEnabled();
      return conversationRepository.listByUser(userId);
    },

    async getConversation(
      userId: string,
      id: string,
    ): Promise<{ conversation: IAiConversation; messages: IAiMessage[] }> {
      assertEnabled();
      const conversation = await getOwnedConversation(userId, id);
      const messages = await messageRepository.listByConversation(id);
      return { conversation, messages };
    },

    async deleteConversation(userId: string, id: string): Promise<void> {
      assertEnabled();
      await getOwnedConversation(userId, id);
      await conversationRepository.softDelete(id);
    },
  };
}

export default aiAssistantDomainFactory;
