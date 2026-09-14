export type ApplicationErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DOMAIN_RULE_VIOLATION'
  | 'DISCOVERY_BOX_INSUFFICIENT_CANDIDATES'
  | 'PERSISTENCE_ERROR'
  | 'UNEXPECTED_ERROR'
  | 'NOT_IMPLEMENTED'
  | 'CART_NOT_FOUND'
  | 'CART_NOT_OWNED'
  | 'CART_ITEM_NOT_FOUND'
  | 'INVALID_QUANTITY'
  | 'INVALID_SKU'
  | 'PRODUCT_NOT_FOUND'
  | 'PRODUCT_UNAVAILABLE'
  | 'INSUFFICIENT_INVENTORY'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_NOT_OWNED'
  | 'ORDER_IDEMPOTENCY_CONFLICT'
  | 'INVALID_CURRENCY'
  | 'PURCHASE_ALREADY_RECORDED'
  | 'PURCHASE_NOT_AUTHORIZED';

export class ApplicationError extends Error {
  constructor(public readonly code: ApplicationErrorCode, message: string, options?: { cause?: unknown }) {
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
