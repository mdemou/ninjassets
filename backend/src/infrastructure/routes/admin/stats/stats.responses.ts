import responsesService from '@services/responses/responses.service';

const statsResponses = {
  overviewOk: responsesService.createInternalResponse(200, 'STA2001', 'Stats retrieved successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'STA4001', message);
  },
};

export default statsResponses;
