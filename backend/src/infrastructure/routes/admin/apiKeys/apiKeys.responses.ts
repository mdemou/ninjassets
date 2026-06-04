import responsesService from '@services/responses/responses.service';

const apiKeysResponses = {
  createOk: responsesService.createInternalResponse(201, 'API2010', 'API key created successfully'),
  listOk: responsesService.createInternalResponse(200, 'API2001', 'API keys retrieved successfully'),
  getOk: responsesService.createInternalResponse(200, 'API2002', 'API key retrieved successfully'),
  revokeOk: responsesService.createInternalResponse(200, 'API2003', 'API key revoked successfully'),
  regenerateOk: responsesService.createInternalResponse(200, 'API2004', 'API key regenerated successfully'),
  accessLogOk: responsesService.createInternalResponse(200, 'API2005', 'Access log retrieved successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'API4001', message);
  },
};

export default apiKeysResponses;
