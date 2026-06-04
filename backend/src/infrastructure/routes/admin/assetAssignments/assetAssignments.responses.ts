import type { ICreateResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

const assetAssignmentsResponses: Record<'bulkOk', ICreateResponseData> & {
  badRequest: (statusCode: number, message: string) => ICreateResponseData;
} = {
  bulkOk: responsesService.createInternalResponse(200, 'BASG2001', 'Bulk assignment processed'),
  badRequest: (statusCode: number, message: string) => {
    return responsesService.createInternalResponse(statusCode, 'BASG4001', message);
  },
};

export default assetAssignmentsResponses;
