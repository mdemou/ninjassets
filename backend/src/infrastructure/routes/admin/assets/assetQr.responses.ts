import responsesService from '@services/responses/responses.service';

const assetQrResponses = {
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'AST4001', message);
  },
  notFound: responsesService.createInternalResponse(404, 'AST4040', 'Asset not found'),
};

export default assetQrResponses;
