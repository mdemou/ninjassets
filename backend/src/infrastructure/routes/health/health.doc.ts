import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import healthResponses from './health.responses';

const healthDocs = {
  liveness: {
    responses: createResponseDoc('liveness', healthResponses.livenessOk),
  },
  readiness: {
    responses: createResponseDoc('readiness', healthResponses.readinessOk, {
      500: { statusCode: 500, code: 'HL5001', message: 'Health error' },
    }),
  },
};

export default healthDocs;
