export type ApplicationErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DOMAIN_RULE_VIOLATION'
  | 'DISCOVERY_BOX_INSUFFICIENT_CANDIDATES'
  | 'PERSISTENCE_ERROR'
  | 'UNEXPECTED_ERROR'
  | 'NOT_IMPLEMENTED';

export class ApplicationError extends Error {
  constructor(
    public readonly code: ApplicationErrorCode,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'ApplicationError';
  }
}

export function isApplicationError(error: unknown): error is ApplicationError {
  return error instanceof ApplicationError;
}

export function toPersistenceError(error: unknown, message = 'Persistence operation failed'): ApplicationError {
  return new ApplicationError('PERSISTENCE_ERROR', message, { cause: error });
}
