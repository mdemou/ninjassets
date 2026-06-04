import type { ServerRoute } from '@hapi/hapi';
import { sitesController } from './sites.controller';
import sitesDocs from './sites.doc';

export const adminListSitesRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/sites',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'List all sites (admin only)',
    handler: sitesController.listSites,
    plugins: { 'hapi-swagger': { responses: sitesDocs.listSites.responses } },
    validate: sitesDocs.listSites.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminGetSiteDetailsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/sites/{id}',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Get site details by id (admin only)',
    handler: sitesController.getSiteDetails,
    plugins: { 'hapi-swagger': { responses: sitesDocs.getSiteDetails.responses } },
    validate: sitesDocs.getSiteDetails.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminCreateSiteRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/sites',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Create a new site (admin only)',
    handler: sitesController.createSite,
    plugins: { 'hapi-swagger': { responses: sitesDocs.createSite.responses } },
    validate: sitesDocs.createSite.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminUpdateSiteRoute: ServerRoute = {
  method: 'PATCH',
  path: '/api/p/sites/{id}',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Update a site (admin only)',
    handler: sitesController.updateSite,
    plugins: { 'hapi-swagger': { responses: sitesDocs.updateSite.responses } },
    validate: sitesDocs.updateSite.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminDeleteSiteRoute: ServerRoute = {
  method: 'DELETE',
  path: '/api/p/sites/{id}',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Delete a site (admin only). Pass ?deleteAssets=true to also delete linked assets',
    handler: sitesController.deleteSite,
    plugins: { 'hapi-swagger': { responses: sitesDocs.deleteSite.responses } },
    validate: sitesDocs.deleteSite.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminListSiteAssetsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/sites/{id}/assets',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'List assets linked to a site (admin only)',
    handler: sitesController.listSiteAssets,
    plugins: { 'hapi-swagger': { responses: sitesDocs.listSiteAssets.responses } },
    validate: sitesDocs.listSiteAssets.parameters,
    tags: ['api', 'admin'],
  },
};
