import assetQrDomainFactory from '@domain/assets/qr/assetQr.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import assetDbRepository from '@infrastructure/repositories/assetDb/assetDb.repository';
import logger from '@services/logger.service';
import responsesService from '@services/responses/responses.service';

const assetQrDomain = assetQrDomainFactory({ assetRepository: assetDbRepository });

export const assetQrController = {
  async getAssetQr(request: Request, h: ResponseToolkit) {
    try {
      const { id } = request.params as { id: string };
      const png = await assetQrDomain.getQrPng(id);
      return h
        .response(png)
        .type('image/png')
        .header('Cache-Control', 'private, max-age=3600');
    } catch (error) {
      logger.error(__filename, 'getAssetQr', 'error', error);
      const response = responsesService.createGeneralError(error);
      return h.response(response.body).code(response.statusCode);
    }
  },
};
