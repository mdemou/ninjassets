import type { ServerRoute } from '@hapi/hapi';
import { vendorsController } from './vendors.controller';
import vendorsDocs from './vendors.doc';

export const adminListVendorsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/vendors',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'List all vendors (admin only)',
    handler: vendorsController.listVendors,
    plugins: { 'hapi-swagger': { responses: vendorsDocs.listVendors.responses } },
    validate: vendorsDocs.listVendors.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminGetVendorDetailsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/vendors/{id}',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Get vendor details by id (admin only)',
    handler: vendorsController.getVendorDetails,
    plugins: { 'hapi-swagger': { responses: vendorsDocs.getVendorDetails.responses } },
    validate: vendorsDocs.getVendorDetails.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminCreateVendorRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/vendors',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Create a new vendor (admin only)',
    handler: vendorsController.createVendor,
    plugins: { 'hapi-swagger': { responses: vendorsDocs.createVendor.responses } },
    validate: vendorsDocs.createVendor.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminUpdateVendorRoute: ServerRoute = {
  method: 'PATCH',
  path: '/api/p/vendors/{id}',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Update a vendor (admin only)',
    handler: vendorsController.updateVendor,
    plugins: { 'hapi-swagger': { responses: vendorsDocs.updateVendor.responses } },
    validate: vendorsDocs.updateVendor.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminDeleteVendorRoute: ServerRoute = {
  method: 'DELETE',
  path: '/api/p/vendors/{id}',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Delete a vendor (admin only)',
    handler: vendorsController.deleteVendor,
    plugins: { 'hapi-swagger': { responses: vendorsDocs.deleteVendor.responses } },
    validate: vendorsDocs.deleteVendor.parameters,
    tags: ['api', 'admin'],
  },
};
