import type { ResponseToolkit } from '@hapi/hapi';
import type { ICreateResponseData } from '@services/responses/responses.interfaces';
import responsesService from '@services/responses/responses.service';

export function createValidationFailAction(badRequest: (statusCode: number, message: string) => ICreateResponseData) {
  return (_request: unknown, h: ResponseToolkit, error: Error | undefined) => {
    const err = error as { output?: { statusCode?: number; payload?: { message?: string } } } | undefined;
    const statusCode = err?.output?.statusCode ?? 400;
    const message = err?.output?.payload?.message ?? 'Validation error';
    const response = responsesService.createResponseData(badRequest(statusCode, message));
    return h.response(response.body).code(response.statusCode).takeover();
  };
}
