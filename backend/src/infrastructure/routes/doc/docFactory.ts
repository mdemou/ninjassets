import type { ICreateResponseData } from '@services/responses/responses.interfaces';
import Joi from 'joi';

/** Standard error response shape (Hapi/Boom 401) */
const UNAUTHORIZED_SCHEMA = (label: string) =>
  Joi.object({
    statusCode: Joi.number().example(401),
    error: Joi.string().example('Unauthorized'),
    message: Joi.string().example('Invalid token'),
  }).label(label);

/** Build base Joi schema from internal response { statusCode, code, message } */
function baseSchema(r: ICreateResponseData, label: string) {
  return Joi.object({
    statusCode: Joi.number().example(r.statusCode),
    code: Joi.string().example(r.code),
    message: Joi.string().example(r.message),
  }).label(label);
}

export interface ResponseDocOptions {
  /** Optional data object schema for 200 response */
  dataSchema?: Joi.ObjectSchema;
  /** 400 Bad Request - pass output of badRequest(400, 'message') */
  400?: ICreateResponseData;
  /** Include 401 Unauthorized (Boom format) */
  401?: boolean;
  /** 403 Forbidden */
  403?: ICreateResponseData;
  /** 404 Not Found */
  404?: ICreateResponseData;
  /** 409 Conflict */
  409?: ICreateResponseData;
  /** 500 Internal error */
  500?: ICreateResponseData;
}

/** Creates hapi-swagger response definitions from response metadata */
export function createResponseDoc(
  routeName: string,
  okResponse: ICreateResponseData,
  options: ResponseDocOptions = {},
): Record<number, { description: string; schema: Joi.ObjectSchema }> {
  const result: Record<number, { description: string; schema: Joi.ObjectSchema }> = {};

  // 200 success
  const okSchema = options.dataSchema
    ? baseSchema(okResponse, `${routeName}Response`).keys({ data: options.dataSchema })
    : baseSchema(okResponse, `${routeName}Response`);
  result[200] = { description: okResponse.message, schema: okSchema };

  if (options[400]) {
    result[400] = {
      description: 'Bad Request',
      schema: baseSchema(options[400], `${routeName}BadRequest`),
    };
  }

  if (options[401]) {
    result[401] = {
      description: 'Unauthorized',
      schema: UNAUTHORIZED_SCHEMA(`${routeName}Unauthorized`),
    };
  }

  if (options[403]) {
    result[403] = {
      description: 'Forbidden',
      schema: baseSchema(options[403], `${routeName}Forbidden`),
    };
  }

  if (options[404]) {
    result[404] = {
      description: 'Not Found',
      schema: baseSchema(options[404], `${routeName}NotFound`),
    };
  }

  if (options[409]) {
    result[409] = {
      description: 'Conflict',
      schema: baseSchema(options[409], `${routeName}Conflict`),
    };
  }

  if (options[500]) {
    result[500] = {
      description: 'Internal server error',
      schema: baseSchema(options[500], `${routeName}InternalError`),
    };
  }

  return result;
}
