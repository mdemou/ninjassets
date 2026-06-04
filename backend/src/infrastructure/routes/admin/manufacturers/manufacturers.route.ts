import type { ServerRoute } from '@hapi/hapi';
import { manufacturersController } from './manufacturers.controller';
import manufacturersDocs from './manufacturers.doc';

export const adminListManufacturersRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/manufacturers',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'List all manufacturers (admin only)',
    handler: manufacturersController.listManufacturers,
    plugins: { 'hapi-swagger': { responses: manufacturersDocs.listManufacturers.responses } },
    validate: manufacturersDocs.listManufacturers.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminGetManufacturerDetailsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/manufacturers/{id}',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Get manufacturer details by id (admin only)',
    handler: manufacturersController.getManufacturerDetails,
    plugins: { 'hapi-swagger': { responses: manufacturersDocs.getManufacturerDetails.responses } },
    validate: manufacturersDocs.getManufacturerDetails.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminCreateManufacturerRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/manufacturers',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Create a new manufacturer (admin only)',
    handler: manufacturersController.createManufacturer,
    plugins: { 'hapi-swagger': { responses: manufacturersDocs.createManufacturer.responses } },
    validate: manufacturersDocs.createManufacturer.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminUpdateManufacturerRoute: ServerRoute = {
  method: 'PATCH',
  path: '/api/p/manufacturers/{id}',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Update a manufacturer (admin only)',
    handler: manufacturersController.updateManufacturer,
    plugins: { 'hapi-swagger': { responses: manufacturersDocs.updateManufacturer.responses } },
    validate: manufacturersDocs.updateManufacturer.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminDeleteManufacturerRoute: ServerRoute = {
  method: 'DELETE',
  path: '/api/p/manufacturers/{id}',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Delete a manufacturer (admin only)',
    handler: manufacturersController.deleteManufacturer,
    plugins: { 'hapi-swagger': { responses: manufacturersDocs.deleteManufacturer.responses } },
    validate: manufacturersDocs.deleteManufacturer.parameters,
    tags: ['api', 'admin'],
  },
};
