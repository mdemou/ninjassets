import { createResponseDoc } from '@infrastructure/routes/doc/docFactory';
import Joi from 'joi';
import avatarResponses from './avatar.responses';

const authHeaders = Joi.object({
  authorization: Joi.string().error(new Error('Authorization token is needed')).required(),
}).unknown();

const idParam = Joi.object({
  id: Joi.string().uuid().required().error(new Error('id must be a valid uuid')),
});

const avatarDocs = {
  upload: {
    responses: createResponseDoc('uploadAvatar', avatarResponses.uploadOk, {
      400: avatarResponses.badRequest(400, 'Uploaded file is not a valid image'),
      401: true,
    }),
    parameters: {
      headers: authHeaders,
      // Raw binary body (image/jpeg|png) — handled at the payload layer (parse:false),
      // so no Joi payload validation here.
    },
  },
  remove: {
    responses: createResponseDoc('removeAvatar', avatarResponses.removeOk, { 401: true }),
    parameters: {
      headers: authHeaders,
    },
  },
  uploadForUser: {
    responses: createResponseDoc('uploadUserAvatar', avatarResponses.uploadOk, {
      400: avatarResponses.badRequest(400, 'Uploaded file is not a valid image'),
      401: true,
      404: avatarResponses.notFound,
    }),
    parameters: {
      headers: authHeaders,
      params: idParam,
    },
  },
  removeForUser: {
    responses: createResponseDoc('removeUserAvatar', avatarResponses.removeOk, {
      401: true,
      404: avatarResponses.notFound,
    }),
    parameters: {
      headers: authHeaders,
      params: idParam,
    },
  },
  get: {
    responses: createResponseDoc('getUserAvatar', avatarResponses.uploadOk, {
      401: true,
      403: avatarResponses.forbidden,
      404: avatarResponses.notFound,
    }),
    parameters: {
      headers: authHeaders,
      params: idParam,
    },
  },
};

export default avatarDocs;
