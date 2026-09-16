import { ApplicationError } from '../application/errors';
import type { ApiErrorBody } from './dto';

const statusByCode: Record<ApplicationError['code'], number> = {
  VALIDATION_ERROR: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  DOMAIN_RULE_VIOLATION: 422,
  DISCOVERY_BOX_INSUFFICIENT_CANDIDATES: 422,
  PERSISTENCE_ERROR: 500,
  AUDIT_WRITE_FAILED: 500,
  UNEXPECTED_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  CART_NOT_FOUND: 404,
  CART_NOT_OWNED: 403,
  CART_ITEM_NOT_FOUND: 404,
  INVALID_QUANTITY: 400,
  INVALID_SKU: 400,
  PRODUCT_NOT_FOUND: 404,
  PRODUCT_UNAVAILABLE: 409,
  INSUFFICIENT_INVENTORY: 409,
  ORDER_NOT_FOUND: 404,
  ORDER_NOT_OWNED: 403,
  ORDER_IDEMPOTENCY_CONFLICT: 409,
  INVALID_CURRENCY: 400,
  PURCHASE_ALREADY_RECORDED: 409,
  PURCHASE_NOT_AUTHORIZED: 403,
  AUTHENTICATION_REQUIRED: 401,
  INVALID_CREDENTIALS: 401,
  FORBIDDEN: 403,
};

export function applicationErrorToHttp(error: unknown, requestId: string): { status: number; body: ApiErrorBody } {
  if (error instanceof ApplicationError) {
    return { status: statusByCode[error.code], body: { error: { code: error.code, message: error.message, requestId } } };
  }
  return { status: 500, body: { error: { code: 'UNEXPECTED_ERROR', message: 'An unexpected error occurred', requestId } } };
}
