import { IWebhookPlatform, IWebhookTarget } from '@domain/_interfaces/webhook.interface';
import { readWebhookPlatformIconPng } from '@domain/webhooks/webhookPlatformIcon';
import webhooksDomainFactory from '@domain/webhooks/webhooks.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import webhookDestinationDbRepository from '@infrastructure/repositories/webhookDestinationDb/webhookDestinationDb.repository';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';
import webhooksResponses from './webhooks.responses';

const webhooksDomain = webhooksDomainFactory({
  webhookDestinationRepository: webhookDestinationDbRepository,
});

function getActorId(request: Request): string {
  return (request.auth.credentials as { id: string }).id;
}

export const webhooksController = {
  listEvents(_request: Request, h: ResponseToolkit) {
    let response: IResponseData;
    try {
      const events = webhooksDomain.listCatalog();
      response = responsesService.createResponseData(webhooksResponses.catalogOk, { events });
    } catch (error) {
      logger.error(__filename, 'listEvents', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  list: async (_request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const destinations = await webhooksDomain.list();
      response = responsesService.createResponseData(webhooksResponses.listOk, {
        destinations,
        total: destinations.length,
      });
    } catch (error) {
      logger.error(__filename, 'list', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  get: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const destination = await webhooksDomain.getDetail(id);
      response = responsesService.createResponseData(webhooksResponses.getOk, { destination });
    } catch (error) {
      logger.error(__filename, 'get', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  create: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const payload = request.payload as {
        name: string;
        platform: string;
        enabled?: boolean;
        target: IWebhookTarget;
        subscribedEvents: string[];
      };
      const destination = await webhooksDomain.create(getActorId(request), payload);
      response = responsesService.createResponseData(webhooksResponses.createOk, { destination });
    } catch (error) {
      logger.error(__filename, 'create', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  update: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      const payload = request.payload as {
        name?: string;
        enabled?: boolean;
        target?: IWebhookTarget;
        subscribedEvents?: string[];
      };
      const destination = await webhooksDomain.update(id, payload);
      response = responsesService.createResponseData(webhooksResponses.updateOk, { destination });
    } catch (error) {
      logger.error(__filename, 'update', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  remove: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      await webhooksDomain.remove(id);
      response = responsesService.createResponseData(webhooksResponses.deleteOk);
    } catch (error) {
      logger.error(__filename, 'remove', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  test: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { id } = request.params as { id: string };
      await webhooksDomain.sendTest(id);
      response = responsesService.createResponseData(webhooksResponses.testOk);
    } catch (error) {
      logger.error(__filename, 'test', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },

  getPlatformIcon: async (request: Request, h: ResponseToolkit) => {
    try {
      const { platform } = request.params as { platform: IWebhookPlatform };
      const png = await readWebhookPlatformIconPng(platform);
      return h.response(png).type('image/png').header('Cache-Control', 'private, max-age=86400');
    } catch (error) {
      logger.error(__filename, 'getPlatformIcon', 'error', error);
      const response = responsesService.createGeneralError(error);
      return h.response(response.body).code(response.statusCode);
    }
  },
};
