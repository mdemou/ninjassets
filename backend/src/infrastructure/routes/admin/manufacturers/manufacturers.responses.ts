import responsesService from '@services/responses/responses.service';

const manufacturersResponses = {
  listOk: responsesService.createInternalResponse(200, 'MFR2001', 'Manufacturers retrieved successfully'),
  getOk: responsesService.createInternalResponse(200, 'MFR2002', 'Manufacturer details retrieved successfully'),
  createOk: responsesService.createInternalResponse(200, 'MFR2010', 'Manufacturer created successfully'),
  updateOk: responsesService.createInternalResponse(200, 'MFR2003', 'Manufacturer updated successfully'),
  deleteOk: responsesService.createInternalResponse(200, 'MFR2004', 'Manufacturer deleted successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'MFR4001', message);
  },
};

export default manufacturersResponses;
