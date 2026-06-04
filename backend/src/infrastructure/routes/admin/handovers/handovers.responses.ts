import type { ICreateResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const handoversResponses: Record<
  'createOk' | 'listOk' | 'listOpenOk' | 'getOk' | 'cancelOk' | 'completeOk',
  ICreateResponseData
> & {
  badRequest: (statusCode: number, message: string) => ICreateResponseData;
} = {
  createOk: responsesService.createInternalResponse(200, 'HND2010', 'Handover created successfully'),
  listOk: responsesService.createInternalResponse(200, 'HND2001', 'Handovers retrieved successfully'),
  listOpenOk: responsesService.createInternalResponse(200, 'HND2005', 'Open handovers retrieved successfully'),
  getOk: responsesService.createInternalResponse(200, 'HND2002', 'Handover retrieved successfully'),
  cancelOk: responsesService.createInternalResponse(200, 'HND2003', 'Handover cancelled successfully'),
  completeOk: responsesService.createInternalResponse(200, 'HND2004', 'Handover completed successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'HND4001', message);
  },
};

export default handoversResponses;
