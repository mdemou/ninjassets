import responsesService from '@services/responses/responses.service';

const alertsResponses = {
  listOk: responsesService.createInternalResponse(200, 'ALT2001', 'Alerts retrieved successfully'),
  badRequest: (statusCode: number, message: string) =>
    responsesService.createInternalResponse(statusCode, 'ALT4000', message),
};

export default alertsResponses;
