import fs from 'fs';
import Boom from '@hapi/boom';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import catalogImageDomainFactory from '@domain/catalog/catalogImage.domain';
import logger from '@services/logger.service';
import {
  ICreateResponseData,
  IResponseData,
} from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

type CatalogImageDomain = ReturnType<typeof catalogImageDomainFactory>;

interface CatalogImageResponses {
  uploadOk: ICreateResponseData;
  removeOk: ICreateResponseData;
}

function getBuffer(request: Request, invalidCode: string): Buffer {
  const payload = request.payload as Buffer | undefined;
  if (!payload || !Buffer.isBuffer(payload) || payload.length === 0) {
    throw Boom.badRequest('No image data received', { code: invalidCode });
  }
  return payload;
}

export function createCatalogImageController(
  domain: CatalogImageDomain,
  responses: CatalogImageResponses,
  invalidPayloadCode: string,
  logPrefix: string,
) {
  return {
    async uploadImage(request: Request, h: ResponseToolkit) {
      let response: IResponseData;
      try {
        const { id } = request.params as { id: string };
        await domain.setImage(id, getBuffer(request, invalidPayloadCode));
        response = responsesService.createResponseData(responses.uploadOk);
      } catch (error) {
        logger.error(__filename, `${logPrefix}uploadImage`, 'error', error);
        response = responsesService.createGeneralError(error);
      }
      return h.response(response.body).code(response.statusCode);
    },

    async removeImage(request: Request, h: ResponseToolkit) {
      let response: IResponseData;
      try {
        const { id } = request.params as { id: string };
        await domain.removeImage(id);
        response = responsesService.createResponseData(responses.removeOk);
      } catch (error) {
        logger.error(__filename, `${logPrefix}removeImage`, 'error', error);
        response = responsesService.createGeneralError(error);
      }
      return h.response(response.body).code(response.statusCode);
    },

    async getImage(request: Request, h: ResponseToolkit) {
      try {
        const { id } = request.params as { id: string };
        const filePath = await domain.getImagePath(id);
        return h
          .response(fs.createReadStream(filePath))
          .type('image/webp')
          .header('Cache-Control', 'private, max-age=300');
      } catch (error) {
        logger.error(__filename, `${logPrefix}getImage`, 'error', error);
        const response = responsesService.createGeneralError(error);
        return h.response(response.body).code(response.statusCode);
      }
    },
  };
}
