import responsesService from '@services/responses/responses.service';

const transactionsResponses = {
  listOk: responsesService.createInternalResponse(200, 'TRX2001', 'Transactions retrieved successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'TRX4001', message);
  },
};

export default transactionsResponses;
