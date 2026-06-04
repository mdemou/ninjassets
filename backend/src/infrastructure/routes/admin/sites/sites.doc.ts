import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import assetsResponses from '@routes/admin/assets/assets.responses';
import Joi from 'joi';
import sitesResponses from './sites.responses';

const latitude = Joi.number().min(-90).max(90);
const longitude = Joi.number().min(-180).max(180);

const siteSchema = Joi.object({
  id: Joi.string().uuid().required(),
  dateCreated: Joi.string().required(),
  dateUpdated: Joi.string().required(),
  name: Joi.string().required(),
  description: Joi.string().allow(null, '').required(),
  address: Joi.string().allow(null, '').required(),
  latitude: Joi.number().required(),
  longitude: Joi.number().required(),
  assetCount: Joi.number().required(),
}).label('Site');

const authHeaders = Joi.object({
  authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
}).unknown();

const siteIdParams = Joi.object({
  id: Joi.string().uuid().required().error(new Error('Valid site id is required')),
});

const listQuery = Joi.object({
  search: Joi.string().allow('').max(200).optional(),
  page: Joi.number().integer().min(1).optional(),
});

const sitesDocs = {
  listSites: {
    responses: createResponseDoc('listSites', sitesResponses.listSitesOk, {
      dataSchema: Joi.object({
        sites: Joi.array().items(siteSchema),
        total: Joi.number(),
        page: Joi.number(),
        pageSize: Joi.number().allow(null),
      }),
      401: true,
      500: { statusCode: 500, code: 'STE5001', message: 'Failed to list sites' },
    }),
    parameters: {
      headers: authHeaders,
      query: Joi.object({
        search: Joi.string().allow('').max(200).optional(),
        page: Joi.number().integer().min(1).optional(),
      }),
      failAction: createValidationFailAction(sitesResponses.badRequest),
    },
  },
  getSiteDetails: {
    responses: createResponseDoc('getSiteDetails', sitesResponses.getSiteOk, {
      dataSchema: Joi.object({ site: siteSchema }),
      401: true,
      404: { statusCode: 404, code: 'STE4040', message: 'Site not found' },
      500: { statusCode: 500, code: 'STE5001', message: 'Failed to get site details' },
    }),
    parameters: {
      headers: authHeaders,
      params: Joi.object({
        id: Joi.string().uuid().required().error(new Error('Valid site id is required')),
      }),
      failAction: createValidationFailAction(sitesResponses.badRequest),
    },
  },
  createSite: {
    responses: createResponseDoc('createSite', sitesResponses.createSiteOk, {
      dataSchema: Joi.object({ site: siteSchema }),
      400: sitesResponses.badRequest(400, 'Validation error'),
      401: true,
      500: { statusCode: 500, code: 'STE5001', message: 'Failed to create site' },
    }),
    parameters: {
      headers: authHeaders,
      payload: Joi.object({
        name: Joi.string().min(1).max(200).required().error(new Error('name is required. Max 200 chars')),
        description: Joi.string().allow('', null).max(2000).optional(),
        address: Joi.string().allow('', null).max(500).optional(),
        latitude: latitude.required().error(new Error('latitude must be between -90 and 90')),
        longitude: longitude.required().error(new Error('longitude must be between -180 and 180')),
      }),
      failAction: createValidationFailAction(sitesResponses.badRequest),
    },
  },
  updateSite: {
    responses: createResponseDoc('updateSite', sitesResponses.updateSiteOk, {
      dataSchema: Joi.object({ site: siteSchema }),
      400: sitesResponses.badRequest(400, 'Validation error'),
      401: true,
      404: { statusCode: 404, code: 'STE4040', message: 'Site not found' },
      500: { statusCode: 500, code: 'STE5001', message: 'Failed to update site' },
    }),
    parameters: {
      headers: authHeaders,
      params: Joi.object({
        id: Joi.string().uuid().required().error(new Error('Valid site id is required')),
      }),
      payload: Joi.object({
        name: Joi.string().min(1).max(200).optional(),
        description: Joi.string().allow('', null).max(2000).optional(),
        address: Joi.string().allow('', null).max(500).optional(),
        latitude: latitude.optional().error(new Error('latitude must be between -90 and 90')),
        longitude: longitude.optional().error(new Error('longitude must be between -180 and 180')),
      })
        .min(1)
        .error(new Error('At least one field to update is required')),
      failAction: createValidationFailAction(sitesResponses.badRequest),
    },
  },
  deleteSite: {
    responses: createResponseDoc('deleteSite', sitesResponses.deleteSiteOk, {
      401: true,
      404: { statusCode: 404, code: 'STE4040', message: 'Site not found' },
      500: { statusCode: 500, code: 'STE5001', message: 'Failed to delete site' },
    }),
    parameters: {
      headers: authHeaders,
      params: siteIdParams,
      query: Joi.object({
        // When true, assets linked to the site are deleted along with it.
        deleteAssets: Joi.boolean().optional(),
      }),
      failAction: createValidationFailAction(sitesResponses.badRequest),
    },
  },
  listSiteAssets: {
    responses: createResponseDoc('listSiteAssets', assetsResponses.listAssetsOk, {
      401: true,
      404: { statusCode: 404, code: 'STE4040', message: 'Site not found' },
      500: { statusCode: 500, code: 'AST5001', message: 'Failed to list site assets' },
    }),
    parameters: {
      headers: authHeaders,
      params: siteIdParams,
      query: listQuery,
      failAction: createValidationFailAction(sitesResponses.badRequest),
    },
  },
};

export default sitesDocs;
