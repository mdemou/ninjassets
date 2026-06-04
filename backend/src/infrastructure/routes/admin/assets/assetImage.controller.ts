import fs from 'fs';
import assetImageDomainFactory from '@domain/assets/image/assetImage.domain';
import Boom from '@hapi/boom';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import assetDbRepository from '@infrastructure/repositories/assetDb/assetDb.repository';
import assetImageResponses from '@routes/admin/assets/assetImage.responses';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const assetImageDomain = assetImageDomainFactory({ assetRepository: assetDbRepository });

function getBuffer(request: Request): Buffer {
  const payload = request.payload as Buffer | undefined;
  if (!payload || !Buffer.isBuffer(payload) || payload.length === 0) {
    throw Boom.badRequest('No image data received', { code: 'AST4002' });
  }
  return payload;
}

export const assetImageController = {
  async uploadAssetImage(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      await assetImageDomain.setImage(id, getBuffer(request));
      response = responsesService.createResponseData(assetImageResponses.uploadOk);
    } catch (error) {
      logger.error(__filename, 'uploadAssetImage', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async removeAssetImage(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      await assetImageDomain.removeImage(id);
      response = responsesService.createResponseData(assetImageResponses.removeOk);
    } catch (error) {
      logger.error(__filename, 'removeAssetImage', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async getAssetImage(request: Request, h: ResponseToolkit) {
    try {
      const { id } = request.params as { id: string };
      const filePath = await assetImageDomain.getImagePath(id);
      return h
        .response(fs.createReadStream(filePath))
        .type('image/webp')
        .header('Cache-Control', 'private, max-age=300');
    } catch (error) {
      logger.error(__filename, 'getAssetImage', 'error', error);
      const response = responsesService.createGeneralError(error);
      return h.response(response.body).code(response.statusCode);
    }
  },
};
