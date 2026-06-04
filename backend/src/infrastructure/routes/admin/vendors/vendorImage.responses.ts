import responsesService from '@services/responses/responses.service';

const vendorImageResponses = {
  uploadOk: responsesService.createInternalResponse(200, 'VND2002', 'Vendor image updated successfully'),
  removeOk: responsesService.createInternalResponse(200, 'VND2003', 'Vendor image removed successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'VND4001', message);
  },
  notFound: responsesService.createInternalResponse(404, 'VND4043', 'Vendor image not found'),
};

export default vendorImageResponses;
