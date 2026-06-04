import responsesService from '@services/responses/responses.service';

const reportsResponses = {
  listOk: responsesService.createInternalResponse(200, 'RPT2001', 'Data quality report retrieved successfully'),
  dismissOk: responsesService.createInternalResponse(200, 'RPT2002', 'Data quality issue dismissed'),
  restoreOk: responsesService.createInternalResponse(200, 'RPT2003', 'Data quality issue restored'),
  badRequest: (statusCode: number, message: string) =>
    responsesService.createInternalResponse(statusCode, 'RPT4000', message),
};

export default reportsResponses;
