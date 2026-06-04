import responsesService from '@services/responses/responses.service';

const meResponses = {
  assetsOk: responsesService.createInternalResponse(200, 'ME2001', 'Your assets retrieved successfully'),
  transactionsOk: responsesService.createInternalResponse(200, 'ME2002', 'Your history retrieved successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'ME4001', message);
  },
};

export default meResponses;
