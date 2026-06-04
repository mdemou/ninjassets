import { IApiKeyWithOwner } from '@domain/_interfaces/apiKey.interface';
import apiKeysDomainFactory from '@domain/apiKeys/apiKeys.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import apiAccessLogDbRepository from '@infrastructure/repositories/apiAccessLogDb/apiAccessLogDb.repository';
import apiKeyDbRepository from '@infrastructure/repositories/apiKeyDb/apiKeyDb.repository';
import userDbRepository from '@infrastructure/repositories/userDb/userDb.repository';
import config from '@config/config';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';
import apiKeysResponses from './apiKeys.responses';

const apiKeysDomain = apiKeysDomainFactory({
  apiKeyRepository: apiKeyDbRepository,
  userRepository: userDbRepository,
});

/** Strip internal-only fields when returning a key over the wire. */
function toApiKeyView(key: IApiKeyWithOwner) {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    capabilities: key.capabilities,
    ownerUserId: key.userId,
    ownerEmail: key.ownerEmail,
    ownerName: key.ownerName,
    ownerAvatarFilename: key.ownerAvatarFilename,
    expiresAt: key.expiresAt,
    revokedAt: key.revokedAt,
    lastUsedAt: key.lastUsedAt,
    createdAt: key.createdAt,
  };
}

function getActorId(request: Request): string {
  return (request.auth.credentials as { id: string }).id;
}

export const apiKeysController = {
  createKey: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const payload = request.payload as {
        name: string;
        expiresAt?: string | null;
        capabilities?: string[];
      };
      const result = await apiKeysDomain.create(getActorId(request), payload);
      response = responsesService.createResponseData(apiKeysResponses.createOk, { apiKey: result });
    } catch (error) {
      logger.error(__filename, 'createKey', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  listKeys: async (_request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const keys = await apiKeysDomain.list();
      response = responsesService.createResponseData(apiKeysResponses.listOk, {
        apiKeys: keys.map(toApiKeyView),
        total: keys.length,
      });
    } catch (error) {
      logger.error(__filename, 'listKeys', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  getKey: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const key = await apiKeysDomain.getDetail(id);
      response = responsesService.createResponseData(apiKeysResponses.getOk, { apiKey: toApiKeyView(key) });
    } catch (error) {
      logger.error(__filename, 'getKey', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  revokeKey: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      await apiKeysDomain.revoke(id);
      response = responsesService.createResponseData(apiKeysResponses.revokeOk);
    } catch (error) {
      logger.error(__filename, 'revokeKey', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  regenerateKey: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const result = await apiKeysDomain.regenerate(id);
      response = responsesService.createResponseData(apiKeysResponses.regenerateOk, { apiKey: result });
    } catch (error) {
      logger.error(__filename, 'regenerateKey', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  listAccessLogs: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { apiKeyId, page } = request.query as { apiKeyId?: string; page?: number };
      const result = await apiAccessLogDbRepository.list({
        apiKeyId,
        page,
        pageSize: config.pagination.pageSize,
      });
      response = responsesService.createResponseData(apiKeysResponses.accessLogOk, result);
    } catch (error) {
      logger.error(__filename, 'listAccessLogs', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
