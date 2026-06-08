import type { ServerRoute } from '@hapi/hapi';
import { aiController } from './ai.controller';
import aiDocs from './ai.doc';

// Admin-only AI assistant (SPEC-AI-ASSISTANT-001 §10). JWTAdmin session only — never API keys.
const AI_AUTH = { strategies: ['JWTAdmin'] };

export const aiChatRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/ai/chat',
  options: {
    auth: AI_AUTH,
    description: 'Send a message to the AI assistant; streaming (SSE) RAG reply (admin only)',
    handler: aiController.chat,
    plugins: { 'hapi-swagger': { responses: aiDocs.chat.responses } },
    validate: aiDocs.chat.parameters,
    tags: ['api', 'admin', 'ai'],
  },
};

export const aiListConversationsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/ai/conversations',
  options: {
    auth: AI_AUTH,
    description: "List the current admin's AI conversations",
    handler: aiController.listConversations,
    plugins: { 'hapi-swagger': { responses: aiDocs.listConversations.responses } },
    validate: aiDocs.listConversations.parameters,
    tags: ['api', 'admin', 'ai'],
  },
};

export const aiGetConversationRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/ai/conversations/{id}',
  options: {
    auth: AI_AUTH,
    description: 'Get an AI conversation with its messages (owner only)',
    handler: aiController.getConversation,
    plugins: { 'hapi-swagger': { responses: aiDocs.getConversation.responses } },
    validate: aiDocs.getConversation.parameters,
    tags: ['api', 'admin', 'ai'],
  },
};

export const aiDeleteConversationRoute: ServerRoute = {
  method: 'DELETE',
  path: '/api/p/ai/conversations/{id}',
  options: {
    auth: AI_AUTH,
    description: 'Delete one of the current admin\'s AI conversations',
    handler: aiController.deleteConversation,
    plugins: { 'hapi-swagger': { responses: aiDocs.deleteConversation.responses } },
    validate: aiDocs.deleteConversation.parameters,
    tags: ['api', 'admin', 'ai'],
  },
};
