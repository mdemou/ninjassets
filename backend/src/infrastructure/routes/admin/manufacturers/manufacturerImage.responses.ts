import responsesService from '@services/responses/responses.service';

const manufacturerImageResponses = {
  uploadOk: responsesService.createInternalResponse(200, 'MFR2002', 'Manufacturer image updated successfully'),
  removeOk: responsesService.createInternalResponse(200, 'MFR2003', 'Manufacturer image removed successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'MFR4001', message);
  },
  notFound: responsesService.createInternalResponse(404, 'MFR4043', 'Manufacturer image not found'),
};

export default manufacturerImageResponses;
