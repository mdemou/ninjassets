import fs from 'fs';
import avatarDomainFactory from '@domain/users/avatar/avatar.domain';
import Boom from '@hapi/boom';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import userDbRepository from '@infrastructure/repositories/userDb/userDb.repository';
import avatarResponses from '@routes/avatar/avatar.responses';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const avatarDomain = avatarDomainFactory({ userRepository: userDbRepository });

interface Credentials {
  id: string;
  role: string;
}

function getCredentials(request: Request): Credentials {
  return request.auth.credentials as unknown as Credentials;
}

function getBuffer(request: Request): Buffer {
  const payload = request.payload as Buffer | undefined;
  if (!payload || !Buffer.isBuffer(payload) || payload.length === 0) {
    throw Boom.badRequest('No image data received', { code: 'AVT4001' });
  }
  return payload;
}

export const avatarController = {
  async uploadMyAvatar(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      await avatarDomain.setAvatar(getCredentials(request).id, getBuffer(request));
      response = responsesService.createResponseData(avatarResponses.uploadOk);
    } catch (error) {
      logger.error(__filename, 'uploadMyAvatar', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async deleteMyAvatar(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      await avatarDomain.removeAvatar(getCredentials(request).id);
      response = responsesService.createResponseData(avatarResponses.removeOk);
    } catch (error) {
      logger.error(__filename, 'deleteMyAvatar', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async uploadUserAvatar(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      await avatarDomain.setAvatar(id, getBuffer(request));
      response = responsesService.createResponseData(avatarResponses.uploadOk);
    } catch (error) {
      logger.error(__filename, 'uploadUserAvatar', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async deleteUserAvatar(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      await avatarDomain.removeAvatar(id);
      response = responsesService.createResponseData(avatarResponses.removeOk);
    } catch (error) {
      logger.error(__filename, 'deleteUserAvatar', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  // Streams a user's avatar image. Admins may fetch any user's avatar; regular
  // users only their own.
  async getUserAvatar(request: Request, h: ResponseToolkit) {
    try {
      const { id } = request.params as { id: string };
      const { id: callerId, role } = getCredentials(request);
      if (role !== 'ADMIN' && callerId !== id) {
        const forbidden = responsesService.createResponseData(avatarResponses.forbidden);
        return h.response(forbidden.body).code(forbidden.statusCode);
      }
      const filePath = await avatarDomain.getAvatarPath(id);
      return h
        .response(fs.createReadStream(filePath))
        .type('image/webp')
        .header('Cache-Control', 'private, no-cache');
    } catch (error) {
      logger.error(__filename, 'getUserAvatar', 'error', error);
      const response = responsesService.createGeneralError(error);
      return h.response(response.body).code(response.statusCode);
    }
  },
};
