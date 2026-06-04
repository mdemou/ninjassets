import responsesService from '@services/responses/responses.service';

const webhooksResponses = {
  catalogOk: responsesService.createInternalResponse(200, 'WHK2006', 'Event catalog retrieved successfully'),
  listOk: responsesService.createInternalResponse(200, 'WHK2001', 'Webhook destinations retrieved successfully'),
  getOk: responsesService.createInternalResponse(200, 'WHK2002', 'Webhook destination retrieved successfully'),
  createOk: responsesService.createInternalResponse(201, 'WHK2010', 'Webhook destination created successfully'),
  updateOk: responsesService.createInternalResponse(200, 'WHK2003', 'Webhook destination updated successfully'),
  deleteOk: responsesService.createInternalResponse(200, 'WHK2004', 'Webhook destination deleted successfully'),
  testOk: responsesService.createInternalResponse(200, 'WHK2005', 'Test message sent successfully'),
  platformIconOk: responsesService.createInternalResponse(200, 'WHK2007', 'Platform icon retrieved successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'WHK4001', message);
  },
};

export default webhooksResponses;
