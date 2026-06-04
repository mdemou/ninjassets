import type { ServerRoute } from '@hapi/hapi';
import { categoriesController } from './categories.controller';
import categoriesDocs from './categories.doc';

export const adminListCategoriesRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/categories',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'List all categories (admin only)',
    handler: categoriesController.listCategories,
    plugins: { 'hapi-swagger': { responses: categoriesDocs.listCategories.responses } },
    validate: categoriesDocs.listCategories.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminGetCategoryDetailsRoute: ServerRoute = {
  method: 'GET',
  path: '/api/p/categories/{id}',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Get category details by id (admin only)',
    handler: categoriesController.getCategoryDetails,
    plugins: { 'hapi-swagger': { responses: categoriesDocs.getCategoryDetails.responses } },
    validate: categoriesDocs.getCategoryDetails.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminCreateCategoryRoute: ServerRoute = {
  method: 'POST',
  path: '/api/p/categories',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Create a new category (admin only)',
    handler: categoriesController.createCategory,
    plugins: { 'hapi-swagger': { responses: categoriesDocs.createCategory.responses } },
    validate: categoriesDocs.createCategory.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminUpdateCategoryRoute: ServerRoute = {
  method: 'PATCH',
  path: '/api/p/categories/{id}',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Update a category (admin only)',
    handler: categoriesController.updateCategory,
    plugins: { 'hapi-swagger': { responses: categoriesDocs.updateCategory.responses } },
    validate: categoriesDocs.updateCategory.parameters,
    tags: ['api', 'admin'],
  },
};

export const adminDeleteCategoryRoute: ServerRoute = {
  method: 'DELETE',
  path: '/api/p/categories/{id}',
  options: {
    auth: { strategies: ['JWTAdminOrApiKey'] },
    description: 'Delete a category (admin only)',
    handler: categoriesController.deleteCategory,
    plugins: { 'hapi-swagger': { responses: categoriesDocs.deleteCategory.responses } },
    validate: categoriesDocs.deleteCategory.parameters,
    tags: ['api', 'admin'],
  },
};
