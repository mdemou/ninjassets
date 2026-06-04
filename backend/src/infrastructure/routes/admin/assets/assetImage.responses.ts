import responsesService from '@services/responses/responses.service';

const assetImageResponses = {
  uploadOk: responsesService.createInternalResponse(200, 'AST2002', 'Asset image updated successfully'),
  removeOk: responsesService.createInternalResponse(200, 'AST2003', 'Asset image removed successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'AST4001', message);
  },
  notFound: responsesService.createInternalResponse(404, 'AST4043', 'Asset image not found'),
};

export default assetImageResponses;
