import { ApplicationError } from '../application/errors';
import type { ApiErrorBody } from './dto';

const statusByCode: Record<ApplicationError['code'], number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  DOMAIN_RULE_VIOLATION: 422,
  PERSISTENCE_ERROR: 500,
  UNEXPECTED_ERROR: 500,
  NOT_IMPLEMENTED: 501,
};

export function applicationErrorToHttp(error: unknown, requestId: string): { status: number; body: ApiErrorBody } {
  if (error instanceof ApplicationError) {
    return {
      status: statusByCode[error.code],
      body: {
        error: {
          code: error.code,
          message: error.message,
          requestId,
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'UNEXPECTED_ERROR',
        message: 'An unexpected error occurred',
        requestId,
      },
    },
  };
}
