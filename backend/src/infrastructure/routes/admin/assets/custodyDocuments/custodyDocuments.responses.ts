import type { ICreateResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const custodyDocumentsResponses: Record<
  'listOk' | 'getOk' | 'uploadOk' | 'deleteOk',
  ICreateResponseData
> & {
  badRequest: (statusCode: number, message: string) => ICreateResponseData;
} = {
  listOk: responsesService.createInternalResponse(200, 'CDOC2001', 'Custody documents retrieved successfully'),
  getOk: responsesService.createInternalResponse(200, 'CDOC2002', 'Custody document retrieved successfully'),
  uploadOk: responsesService.createInternalResponse(200, 'CDOC2003', 'Custody document uploaded successfully'),
  deleteOk: responsesService.createInternalResponse(200, 'CDOC2004', 'Custody document deleted successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'CDOC4001', message);
  },
};

export default custodyDocumentsResponses;
