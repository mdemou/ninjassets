import responsesService from '@services/responses/responses.service';

const assetsResponses = {
  listAssetsOk: responsesService.createInternalResponse(200, 'AST2001', 'Assets retrieved successfully'),
  listMapMarkersOk: responsesService.createInternalResponse(200, 'AST2005', 'Asset map markers retrieved successfully'),
  getAssetOk: responsesService.createInternalResponse(200, 'AST2002', 'Asset details retrieved successfully'),
  createAssetOk: responsesService.createInternalResponse(200, 'AST2010', 'Asset created successfully'),
  updateAssetOk: responsesService.createInternalResponse(200, 'AST2003', 'Asset updated successfully'),
  deleteAssetOk: responsesService.createInternalResponse(200, 'AST2004', 'Asset deleted successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'AST4001', message);
  },
};

export default assetsResponses;
