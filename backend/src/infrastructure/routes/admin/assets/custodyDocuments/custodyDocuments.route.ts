import config from '@config/config';
import type { ServerRoute } from '@hapi/hapi';
import { custodyDocumentsController } from './custodyDocuments.controller';
import custodyDocumentsDocs from './custodyDocuments.doc';

const BASE = '/api/p/assets/{id}/custody-documents';

// Raw PDF body (no Sharp/image parsing); metadata travels in the query string.
const pdfUploadPayload = {
  maxBytes: config.uploads.custodyDocumentMaxBytes,
  output: 'data' as const,
  parse: false,
  allow: ['application/pdf'],
};

export const adminListCustodyDocumentsRoute: ServerRoute = {
  method: 'GET',
  path: BASE,
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'List custody documents for an asset (admin only)',
    handler: custodyDocumentsController.list,
    plugins: { 'hapi-swagger': { responses: custodyDocumentsDocs.list.responses } },
    validate: custodyDocumentsDocs.list.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminUploadCustodyDocumentRoute: ServerRoute = {
  method: 'POST',
  path: `${BASE}/upload`,
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Upload a signed custody document PDF (admin only)',
    handler: custodyDocumentsController.upload,
    payload: pdfUploadPayload,
    plugins: { 'hapi-swagger': { responses: custodyDocumentsDocs.upload.responses } },
    validate: custodyDocumentsDocs.upload.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminGenerateCustodyDocumentRoute: ServerRoute = {
  method: 'POST',
  path: `${BASE}/generate`,
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Generate a printable custody receipt PDF (admin only)',
    handler: custodyDocumentsController.generate,
    plugins: { 'hapi-swagger': { responses: custodyDocumentsDocs.generate.responses } },
    validate: custodyDocumentsDocs.generate.parameters,
    tags: ['api', 'admin'],
  },
};

// Not nested under an asset id: a batch receipt spans many assets.
export const adminGenerateBatchCustodyDocumentRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/custody-documents/generate-batch',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Generate a multi-asset custody receipt PDF (admin only)',
    handler: custodyDocumentsController.generateBatch,
    plugins: { 'hapi-swagger': { responses: custodyDocumentsDocs.generateBatch.responses } },
    validate: custodyDocumentsDocs.generateBatch.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminGetCustodyDocumentRoute: ServerRoute = {
  method: 'GET',
  path: `${BASE}/{documentId}`,
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Get custody document metadata (admin only)',
    handler: custodyDocumentsController.get,
    plugins: { 'hapi-swagger': { responses: custodyDocumentsDocs.get.responses } },
    validate: custodyDocumentsDocs.get.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminGetCustodyDocumentFileRoute: ServerRoute = {
  method: 'GET',
  path: `${BASE}/{documentId}/file`,
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Stream a custody document PDF inline (admin only)',
    handler: custodyDocumentsController.getFile,
    plugins: { 'hapi-swagger': { responses: custodyDocumentsDocs.getFile.responses } },
    validate: custodyDocumentsDocs.getFile.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminDeleteCustodyDocumentRoute: ServerRoute = {
  method: 'DELETE',
  path: `${BASE}/{documentId}`,
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Delete a custody document (admin only)',
    handler: custodyDocumentsController.remove,
    plugins: { 'hapi-swagger': { responses: custodyDocumentsDocs.remove.responses } },
    validate: custodyDocumentsDocs.remove.parameters,
    tags: ['api', 'admin'],
  },
};
