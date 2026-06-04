import transactionDomainFactory from '@domain/transactions/transactions.domain';
import type { Request, ResponseToolkit } from '@hapi/hapi';
import transactionDbRepository from '@infrastructure/repositories/transactionDb/transactionDb.repository';
import transactionsResponses from '@routes/admin/transactions/transactions.responses';
import logger from '@services/logger.service';
import { IResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const transactionDomain = transactionDomainFactory({
  transactionRepository: transactionDbRepository,
});

export const transactionsController = {
  list: async (request: Request, h: ResponseToolkit) => {
    let response: IResponseData;
    try {
      const { search, page } = request.query as { search?: string; page?: number };
      const result = await transactionDomain.listTransactions({ search, page });
      response = responsesService.createResponseData(transactionsResponses.listOk, result);
    } catch (error) {
      logger.error(__filename, 'list', 'error', error);
      response = responsesService.createGeneralError(error);
    }
    return h.response(response.body).code(response.statusCode);
  },
};
