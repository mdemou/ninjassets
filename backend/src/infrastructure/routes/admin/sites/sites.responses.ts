import responsesService from '@services/responses/responses.service';

const sitesResponses = {
  listSitesOk: responsesService.createInternalResponse(200, 'STE2001', 'Sites retrieved successfully'),
  getSiteOk: responsesService.createInternalResponse(200, 'STE2002', 'Site details retrieved successfully'),
  createSiteOk: responsesService.createInternalResponse(200, 'STE2010', 'Site created successfully'),
  updateSiteOk: responsesService.createInternalResponse(200, 'STE2003', 'Site updated successfully'),
  deleteSiteOk: responsesService.createInternalResponse(200, 'STE2004', 'Site deleted successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'STE4001', message);
  },
};

export default sitesResponses;
