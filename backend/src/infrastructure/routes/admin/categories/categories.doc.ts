import { ICategoryFieldType } from '@domain/_interfaces/category.interface';
import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import { createValidationFailAction } from '@infrastructure/routes/session/validationFailAction';
import Joi from 'joi';
import categoriesResponses from './categories.responses';

const FIELD_TYPES = Object.values(ICategoryFieldType);

const fieldSchema = Joi.object({
  id: Joi.string().uuid().required(),
  categoryId: Joi.string().uuid().required(),
  fieldKey: Joi.string().required(),
  label: Joi.string().required(),
  dataType: Joi.string()
    .valid(...FIELD_TYPES)
    .required(),
  required: Joi.boolean().required(),
  options: Joi.array().items(Joi.string()).allow(null).required(),
  helpText: Joi.string().allow(null).required(),
  placeholder: Joi.string().allow(null).required(),
  unit: Joi.string().allow(null).required(),
  sortOrder: Joi.number().integer().required(),
}).label('CategoryField');

const categorySchema = Joi.object({
  id: Joi.string().uuid().required(),
  dateCreated: Joi.string().required(),
  dateUpdated: Joi.string().required(),
  name: Joi.string().required(),
  icon: Joi.string().allow(null).required(),
  description: Joi.string().allow(null).required(),
  assetCount: Joi.number().optional(),
  fieldCount: Joi.number().optional(),
  fields: Joi.array().items(fieldSchema).optional(),
}).label('Category');

const fieldInputSchema = Joi.object({
  fieldKey: Joi.string().max(100).optional(),
  label: Joi.string().min(1).max(200).required(),
  dataType: Joi.string()
    .valid(...FIELD_TYPES)
    .required(),
  required: Joi.boolean().optional(),
  options: Joi.array().items(Joi.string().max(200)).allow(null).optional(),
  helpText: Joi.string().max(500).allow('', null).optional(),
  placeholder: Joi.string().max(200).allow('', null).optional(),
  unit: Joi.string().max(50).allow('', null).optional(),
  sortOrder: Joi.number().integer().optional(),
});

const authHeaders = Joi.object({
  authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
}).unknown();

const idParams = Joi.object({
  id: Joi.string().uuid().required().error(new Error('Valid category id is required')),
});

const categoriesDocs = {
  listCategories: {
    responses: createResponseDoc('listCategories', categoriesResponses.listOk, {
      dataSchema: Joi.object({
        categories: Joi.array().items(categorySchema),
        total: Joi.number(),
        page: Joi.number(),
        pageSize: Joi.number().allow(null),
      }),
      401: true,
      500: { statusCode: 500, code: 'CAT5001', message: 'Failed to list categories' },
    }),
    parameters: {
      headers: authHeaders,
      query: Joi.object({
        search: Joi.string().allow('').max(200).optional(),
        page: Joi.number().integer().min(1).optional(),
      }),
      failAction: createValidationFailAction(categoriesResponses.badRequest),
    },
  },
  getCategoryDetails: {
    responses: createResponseDoc('getCategoryDetails', categoriesResponses.getOk, {
      dataSchema: Joi.object({ category: categorySchema }),
      401: true,
      404: { statusCode: 404, code: 'CAT4040', message: 'Category not found' },
      500: { statusCode: 500, code: 'CAT5001', message: 'Failed to get category details' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      failAction: createValidationFailAction(categoriesResponses.badRequest),
    },
  },
  createCategory: {
    responses: createResponseDoc('createCategory', categoriesResponses.createOk, {
      dataSchema: Joi.object({ category: categorySchema }),
      400: categoriesResponses.badRequest(400, 'Validation error'),
      401: true,
      409: { statusCode: 409, code: 'CAT4090', message: 'A category with this name already exists' },
      500: { statusCode: 500, code: 'CAT5001', message: 'Failed to create category' },
    }),
    parameters: {
      headers: authHeaders,
      payload: Joi.object({
        name: Joi.string().min(1).max(200).required().error(new Error('name is required. Max 200 chars')),
        icon: Joi.string().max(50).allow('', null).optional(),
        description: Joi.string().max(500).allow('', null).optional(),
        fields: Joi.array().items(fieldInputSchema).optional(),
      }),
      failAction: createValidationFailAction(categoriesResponses.badRequest),
    },
  },
  updateCategory: {
    responses: createResponseDoc('updateCategory', categoriesResponses.updateOk, {
      dataSchema: Joi.object({ category: categorySchema }),
      400: categoriesResponses.badRequest(400, 'Validation error'),
      401: true,
      404: { statusCode: 404, code: 'CAT4040', message: 'Category not found' },
      409: { statusCode: 409, code: 'CAT4090', message: 'A category with this name already exists' },
      500: { statusCode: 500, code: 'CAT5001', message: 'Failed to update category' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      payload: Joi.object({
        name: Joi.string().min(1).max(200).optional(),
        icon: Joi.string().max(50).allow('', null).optional(),
        description: Joi.string().max(500).allow('', null).optional(),
        fields: Joi.array().items(fieldInputSchema).optional(),
      })
        .min(1)
        .error(new Error('At least one field to update is required')),
      failAction: createValidationFailAction(categoriesResponses.badRequest),
    },
  },
  deleteCategory: {
    responses: createResponseDoc('deleteCategory', categoriesResponses.deleteOk, {
      401: true,
      404: { statusCode: 404, code: 'CAT4040', message: 'Category not found' },
      409: { statusCode: 409, code: 'CAT4091', message: 'Category is in use' },
      500: { statusCode: 500, code: 'CAT5001', message: 'Failed to delete category' },
    }),
    parameters: {
      headers: authHeaders,
      params: idParams,
      failAction: createValidationFailAction(categoriesResponses.badRequest),
    },
  },
};

export default categoriesDocs;
