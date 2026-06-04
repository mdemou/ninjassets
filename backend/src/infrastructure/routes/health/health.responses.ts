import responsesService from '@services/responses/responses.service';

const healthResponses = {
  livenessOk: responsesService.createInternalResponse(200, 'HL2001', 'Liveness OK'),
  readinessOk: responsesService.createInternalResponse(200, 'HL2002', 'Readiness OK'),
};

export default healthResponses;
