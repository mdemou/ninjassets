import fs from 'fs';
import { ICustodyDocumentType } from '@domain/_interfaces/custodyDocument.interface';
import custodyDocumentDomainFactory from '@domain/custodyDocuments/custodyDocuments.domain';
import Boom from '@hapi/boom';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import assetDbRepository from '@infrastructure/repositories/assetDb/assetDb.repository';
import custodyDocumentDbRepository from '@infrastructure/repositories/custodyDocumentDb/custodyDocumentDb.repository';
import transactionDbRepository from '@infrastructure/repositories/transactionDb/transactionDb.repository';
import userDbRepository from '@infrastructure/repositories/userDb/userDb.repository';
import { CustodyLocale } from '@services/custodyDocumentPdf.service';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';
import custodyDocumentsResponses from './custodyDocuments.responses';

const custodyDocumentDomain = custodyDocumentDomainFactory({
  custodyDocumentRepository: custodyDocumentDbRepository,
  assetRepository: assetDbRepository,
  userRepository: userDbRepository,
  transactionRepository: transactionDbRepository,
});

function getRequester(request: Request): { id: string; role: string } {
  const credentials = request.auth.credentials as { id: string; role: string };
  return { id: credentials.id, role: credentials.role };
}

function getBuffer(request: Request): Buffer {
  const payload = request.payload as Buffer | undefined;
  if (!payload || !Buffer.isBuffer(payload) || payload.length === 0) {
    throw Boom.badRequest('No PDF data received', { code: 'CDOC4002' });
  }
  return payload;
}

export const custodyDocumentsController = {
  async list(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const documents = await custodyDocumentDomain.listForAsset(id);
      response = responsesService.createResponseData(custodyDocumentsResponses.listOk, { documents });
    } catch (error) {
      logger.error(__filename, 'list', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async get(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const { id, documentId } = request.params as { id: string; documentId: string };
      const document = await custodyDocumentDomain.getDocument(id, documentId);
      response = responsesService.createResponseData(custodyDocumentsResponses.getOk, { document });
    } catch (error) {
      logger.error(__filename, 'get', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async upload(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const query = request.query as {
        type: ICustodyDocumentType;
        handoverId?: string;
        documentDate?: string;
        notes?: string;
        filename?: string;
      };
      const document = await custodyDocumentDomain.uploadSigned(
        id,
        getBuffer(request),
        {
          type: query.type,
          handoverId: query.handoverId ?? null,
          documentDate: query.documentDate ?? null,
          notes: query.notes ?? null,
          originalFilename: query.filename ?? null,
        },
        getRequester(request),
      );
      response = responsesService.createResponseData(custodyDocumentsResponses.uploadOk, { document });
    } catch (error) {
      logger.error(__filename, 'upload', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async getFile(request: Request, h: ResponseToolkit) {
    try {
      const { id, documentId } = request.params as { id: string; documentId: string };
      const filePath = await custodyDocumentDomain.getFilePath(id, documentId);
      return h
        .response(fs.createReadStream(filePath))
        .type('application/pdf')
        .header('Content-Disposition', 'inline')
        .header('Cache-Control', 'private, max-age=300');
    } catch (error) {
      logger.error(__filename, 'getFile', 'error', error);
      const response = responsesService.createGeneralError(error);
      return h.response(response.body).code(response.statusCode);
    }
  },

  async remove(request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const { id, documentId } = request.params as { id: string; documentId: string };
      await custodyDocumentDomain.deleteDocument(id, documentId, getRequester(request));
      response = responsesService.createResponseData(custodyDocumentsResponses.deleteOk);
    } catch (error) {
      logger.error(__filename, 'remove', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  async generate(request: Request, h: ResponseToolkit) {
    try {
      const { id } = request.params as { id: string };
      const { lang } = request.query as { lang?: CustodyLocale };
      const payload = request.payload as {
        type: ICustodyDocumentType;
        targetUserId?: string | null;
        handoverId?: string | null;
        condition?: string | null;
        accessoriesNote?: string | null;
      };
      const pdf = await custodyDocumentDomain.generate(
        id,
        {
          type: payload.type,
          targetUserId: payload.targetUserId ?? null,
          handoverId: payload.handoverId ?? null,
          condition: payload.condition ?? null,
          accessoriesNote: payload.accessoriesNote ?? null,
        },
        lang ?? 'en',
      );
      const suffix = payload.type === ICustodyDocumentType.CHECK_IN ? 'return' : 'checkout';
      return h
        .response(pdf)
        .type('application/pdf')
        .header('Content-Disposition', `attachment; filename="custody-${suffix}-${id}.pdf"`)
        .header('Cache-Control', 'no-store');
    } catch (error) {
      logger.error(__filename, 'generate', 'error', error);
      const response = responsesService.createGeneralError(error);
      return h.response(response.body).code(response.statusCode);
    }
  },

  async generateBatch(request: Request, h: ResponseToolkit) {
    try {
      const { lang } = request.query as { lang?: CustodyLocale };
      const payload = request.payload as {
        type: ICustodyDocumentType;
        assetIds: string[];
        targetUserId?: string | null;
        condition?: string | null;
        accessoriesNote?: string | null;
      };
      const pdf = await custodyDocumentDomain.generateBatch(
        payload.assetIds,
        {
          type: payload.type,
          targetUserId: payload.targetUserId ?? null,
          condition: payload.condition ?? null,
          accessoriesNote: payload.accessoriesNote ?? null,
        },
        lang ?? 'en',
      );
      const suffix = payload.type === ICustodyDocumentType.CHECK_IN ? 'return' : 'checkout';
      return h
        .response(pdf)
        .type('application/pdf')
        .header('Content-Disposition', `attachment; filename="custody-${suffix}-batch.pdf"`)
        .header('Cache-Control', 'no-store');
    } catch (error) {
      logger.error(__filename, 'generateBatch', 'error', error);
      const response = responsesService.createGeneralError(error);
      return h.response(response.body).code(response.statusCode);
    }
  },
};
