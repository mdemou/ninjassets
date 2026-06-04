import type { ServerRoute } from '@hapi/hapi';
import { CapabilityEnum } from '@infrastructure/roles/capabilities';
import { assetAssignmentsController } from './assetAssignments.controller';
import assetAssignmentsDocs from './assetAssignments.doc';

export const adminBulkAssignRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/asset-assignments/bulk',
  options: {
    auth: {
      strategies: ['JWTAdminOrApiKey'],
    },
    app: { capability: CapabilityEnum.ASSETS_WRITE },
    description: 'Bulk assign or return multiple assets for a user (admin only)',
    handler: assetAssignmentsController.bulkAssign,
    plugins: {
      'hapi-swagger': {
        responses: assetAssignmentsDocs.bulkAssign.responses,
      },
    },
    validate: assetAssignmentsDocs.bulkAssign.parameters,
    tags: ['api', 'admin'],
  },
};
