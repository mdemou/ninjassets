import type { ServerRoute } from '@hapi/hapi';
import { reportsController } from './reports.controller';
import reportsDocs from './reports.doc';

export const adminDataQualityReportRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/reports/data-quality',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'List data quality issues (admin only)',
    handler: reportsController.dataQuality,
    plugins: { 'hapi-swagger': { responses: reportsDocs.dataQuality.responses } },
    validate: reportsDocs.dataQuality.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminDismissDataQualityRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/reports/data-quality/dismiss',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Dismiss a data quality issue from overview/bell lists (admin only)',
    handler: reportsController.dismiss,
    plugins: { 'hapi-swagger': { responses: reportsDocs.dismiss.responses } },
    validate: reportsDocs.dismiss.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminRestoreDataQualityRoute: ServerRoute = {
  method: 'DELETE',
  path: '/api/p/reports/data-quality/dismiss',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Undo a data quality issue dismissal (admin only)',
    handler: reportsController.restore,
    plugins: { 'hapi-swagger': { responses: reportsDocs.restore.responses } },
    validate: reportsDocs.restore.parameters,
    tags: ['api', 'admin'],
  },
};
