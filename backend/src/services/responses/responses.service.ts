import { ICreateGeneralError, ICreateResponseData, IResponseData } from './responses.interfaces';

function normalizeError(error: unknown): ICreateGeneralError {
  if (
    error &&
    typeof error === 'object' &&
    'output' in error &&
    typeof (error as { output?: unknown }).output === 'object'
  ) {
    const err = error as ICreateGeneralError;
    return {
      message: err.message ?? 'Unknown error',
      output: { statusCode: (err.output?.statusCode) ?? 500 },
      data: err.data,
    };
  }
  if (error instanceof Error) {
    return { message: error.message, output: { statusCode: 500 } };
  }
  if (typeof error === 'string') {
    return { message: error, output: { statusCode: 500 } };
  }
  return { message: 'Unknown error', output: { statusCode: 500 } };
}

const responseService = {
  createResponseData: (result: ICreateResponseData, extraData?: object) => {
    const response: IResponseData = {
      statusCode: result.statusCode,
      body: {
        statusCode: result.statusCode,
        code: result.code,
        message: result.message,
      },
    };
    if (extraData) {
      response.body.data = extraData;
    }
    return response;
  },

  createInternalResponse(statusCode: number, code: string, message: string): ICreateResponseData {
    return {
      statusCode,
      code,
      message,
    };
  },

  createGeneralError(error: unknown) {
    const normalized = normalizeError(error);
    return {
      statusCode: normalized.output.statusCode,
      body: {
        statusCode: normalized.output.statusCode,
        code: normalized.data?.code ?? 'GRR000X',
        message: normalized.message,
      },
    };
  },
};

export default responseService;
