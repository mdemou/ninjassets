import { PassThrough } from 'node:stream';

import config from '@config/config';
import { AiLocale, IAiConversation, IAiMessage } from '@domain/_interfaces/aiAssistant.interface';
import aiAssistantDomainFactory from '@domain/aiAssistant/aiAssistant.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import aiConversationDbRepository from '@infrastructure/repositories/aiConversationDb/aiConversationDb.repository';
import aiMessageDbRepository from '@infrastructure/repositories/aiMessageDb/aiMessageDb.repository';
import httpAiAgentService from '@infrastructure/repositories/_services/aiAgentService/httpAiAgentService';
import mockAiAgentService from '@infrastructure/repositories/_services/aiAgentService/mockAiAgentService';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';
import aiResponses from './ai.responses';

const aiDomain = aiAssistantDomainFactory({
  conversationRepository: aiConversationDbRepository,
  messageRepository: aiMessageDbRepository,
  // MOCK_AI returns canned SSE; otherwise stream from the real aiagent (D18).
  aiAgentService: config.mockAi ? mockAiAgentService : httpAiAgentService,
});

function getActorId(request: Request): string {
  return (request.auth.credentials as { id: string }).id;
}

function conversationView(c: IAiConversation) {
  return { id: c.id, title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt };
}

function messageView(m: IAiMessage) {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    locale: m.locale,
    sources: m.sources,
    createdAt: m.createdAt,
  };
}

export const aiController = {
  // Streaming SSE (§9.5). Eager errors (flag/validation/rate-limit) surface as proper
  // HTTP codes; once streaming starts the body is text/event-stream.
  chat: async (request: Request, h: ResponseToolkit) => {
    try {
      const payload = request.payload as { message: string; conversationId?: string; locale: AiLocale };
      const events = await aiDomain.beginChat(getActorId(request), payload);

      // Byte stream (not Readable.from over strings, which is object-mode and won't
      // flush through hapi/proxies). Pump SSE frames as they arrive, then close.
      const stream = new PassThrough();
      void (async () => {
        try {
          for await (const event of events) {
            stream.write(`data: ${JSON.stringify(event)}\n\n`);
          }
        } catch (error) {
          logger.error(__filename, 'chat', 'stream error', error);
          stream.write(`data: ${JSON.stringify({ error: 'stream_failed' })}\n\n`);
        } finally {
          stream.write('data: [DONE]\n\n');
          stream.end();
        }
      })();

      return h
        .response(stream)
        .type('text/event-stream')
        .header('cache-control', 'no-cache')
        // Disable hapi's gzip compression: it buffers tokens internally and would
        // collapse the SSE stream into one burst, defeating incremental rendering.
        // A preset content-encoding makes hapi skip its compressor (§9.5).
        .header('content-encoding', 'identity')
        .header('x-accel-buffering', 'no');
    } catch (error) {
      logger.error(__filename, 'chat', 'error', error);
      const response = responsesService.createGeneralError(error);
      return h.response(response.body).code(response.statusCode);
    }
  },

  listConversations: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const conversations = await aiDomain.listConversations(getActorId(request));
      response = responsesService.createResponseData(aiResponses.conversationsOk, {
        conversations: conversations.map(conversationView),
        total: conversations.length,
      });
    } catch (error) {
      logger.error(__filename, 'listConversations', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  getConversation: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const { conversation, messages } = await aiDomain.getConversation(getActorId(request), id);
      response = responsesService.createResponseData(aiResponses.conversationOk, {
        conversation: conversationView(conversation),
        messages: messages.map(messageView),
      });
    } catch (error) {
      logger.error(__filename, 'getConversation', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  deleteConversation: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      await aiDomain.deleteConversation(getActorId(request), id);
      response = responsesService.createResponseData(aiResponses.deleteOk);
    } catch (error) {
      logger.error(__filename, 'deleteConversation', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
