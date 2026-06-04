import type { ICreateResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const meHandoversResponses: Record<'previewOk' | 'acceptOk' | 'listOk', ICreateResponseData> & {
  badRequest: (statusCode: number, message: string) => ICreateResponseData;
} = {
  previewOk: responsesService.createInternalResponse(200, 'HND2020', 'Handover preview retrieved successfully'),
  acceptOk: responsesService.createInternalResponse(200, 'HND2021', 'Handover accepted successfully'),
  listOk: responsesService.createInternalResponse(200, 'HND2022', 'Pending handovers retrieved successfully'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'HND4001', message);
  },
};

export default meHandoversResponses;
