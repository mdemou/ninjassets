import responsesService from '@services/responses/responses.service';

const categoriesResponses = {
  listOk: responsesService.createInternalResponse(200, 'CAT2001', 'Categories retrieved successfully'),
  getOk: responsesService.createInternalResponse(200, 'CAT2002', 'Category details retrieved successfully'),
  createOk: responsesService.createInternalResponse(200, 'CAT2010', 'Category created successfully'),
  updateOk: responsesService.createInternalResponse(200, 'CAT2003', 'Category updated successfully'),
  deleteOk: responsesService.createInternalResponse(200, 'CAT2004', 'Category deleted successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'CAT4001', message);
  },
};

export default categoriesResponses;
