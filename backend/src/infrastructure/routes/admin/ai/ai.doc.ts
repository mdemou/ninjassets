import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import aiResponses from './ai.responses';

const authHeaders = Joi.object({
  authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
}).unknown();

const idParams = Joi.object({
  id: Joi.string().uuid().required().error(new Error('Valid conversation id is required')),
});

const sourceSchema = Joi.object({
  documentName: Joi.string(),
  documentId: Joi.string(),
  excerpt: Joi.string(),
  score: Joi.number(),
}).label('AiSource');

const conversationSchema = Joi.object({
  id: Joi.string().uuid(),
  title: Joi.string(),
  createdAt: Joi.string(),
  updatedAt: Joi.string(),
}).label('AiConversation');

const messageSchema = Joi.object({
  id: Joi.string().uuid(),
  role: Joi.string().valid('user', 'assistant'),
  content: Joi.string().allow(''),
  locale: Joi.string().valid('en', 'es'),
  sources: Joi.array().items(sourceSchema).allow(null),
  createdAt: Joi.string(),
}).label('AiMessage');

const aiDocs = {
  chat: {
    responses: createResponseDoc('aiChat', aiResponses.chatOk, {
      400: aiResponses.badRequest(400, 'Invalid chat request'),
      401: true,
      403: aiResponses.badRequest(403, 'Admin access required'),
      409: { statusCode: 429, code: 'AI4290', message: 'Rate limit exceeded' },
      500: { statusCode: 503, code: 'AI5030', message: 'AI assistant is unavailable' },
    }),
    parameters: {
      payload: Joi.object({
        message: Joi.string().min(3).max(2000).required(),
        conversationId: Joi.string().uuid().optional(),
        locale: Joi.string().valid('en', 'es').required(),
      }),
      headers: authHeaders,
      failAction: createValidationFailAction(aiResponses.badRequest),
    },
  },

  listConversations: {
    responses: createResponseDoc('aiListConversations', aiResponses.conversationsOk, {
      dataSchema: Joi.object({
        conversations: Joi.array().items(conversationSchema),
        total: Joi.number(),
      }),
      401: true,
    }),
    parameters: { headers: authHeaders },
  },

  getConversation: {
    responses: createResponseDoc('aiGetConversation', aiResponses.conversationOk, {
      dataSchema: Joi.object({
        conversation: conversationSchema,
        messages: Joi.array().items(messageSchema),
      }),
      401: true,
      404: { statusCode: 404, code: 'AI4040', message: 'Conversation not found' },
    }),
    parameters: {
      params: idParams,
      headers: authHeaders,
      failAction: createValidationFailAction(aiResponses.badRequest),
    },
  },

  deleteConversation: {
    responses: createResponseDoc('aiDeleteConversation', aiResponses.deleteOk, {
      401: true,
      404: { statusCode: 404, code: 'AI4040', message: 'Conversation not found' },
    }),
    parameters: {
      params: idParams,
      headers: authHeaders,
      failAction: createValidationFailAction(aiResponses.badRequest),
    },
  },
};

export default aiDocs;
