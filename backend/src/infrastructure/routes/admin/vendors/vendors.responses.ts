import responsesService from '@services/responses/responses.service';

const vendorsResponses = {
  listOk: responsesService.createInternalResponse(200, 'VND2001', 'Vendors retrieved successfully'),
  getOk: responsesService.createInternalResponse(200, 'VND2002', 'Vendor details retrieved successfully'),
  createOk: responsesService.createInternalResponse(200, 'VND2010', 'Vendor created successfully'),
  updateOk: responsesService.createInternalResponse(200, 'VND2003', 'Vendor updated successfully'),
  deleteOk: responsesService.createInternalResponse(200, 'VND2004', 'Vendor deleted successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'VND4001', message);
  },
};

export default vendorsResponses;
