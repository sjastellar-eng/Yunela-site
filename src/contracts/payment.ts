import type { Money } from './commerce';

export type PaymentProvider = 'MONO';
export type PaymentAttemptState = 'CREATED' | 'INITIATED' | 'REQUIRES_ACTION' | 'SUCCEEDED' | 'DECLINED' | 'EXPIRED' | 'FAILED' | 'CANCELLED';

export interface PaymentAttempt {
  id: string;
  orderId: string;
  customerId: string;
  provider: PaymentProvider;
  providerInvoiceId?: string;
  merchantReference: string;
  requestedAmount: Money;
  requestedCurrency: 'UAH';
  state: PaymentAttemptState;
  providerStatus?: string;
  providerModifiedAt?: string;
  providerEventFingerprint?: string;
  providerEventReference?: string;
  idempotencyKey: string;
  paymentPageUrl?: string;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
}

export interface MonoInvoiceCreationResult {
  providerInvoiceId: string;
  paymentPageUrl: string;
}

export interface MonoInvoiceEvent {
  invoiceId: string;
  status: 'created' | 'processing' | 'hold' | 'success' | 'failure' | 'reversed' | 'expired' | string;
  amount: number;
  ccy: number;
  finalAmount?: number;
  createdDate?: string;
  modifiedDate?: string;
  reference?: string;
  failureReason?: string;
}

export interface MonoPaymentAdapter {
  createInvoice(input: {
    amount: number;
    currency: 980;
    merchantReference: string;
    redirectUrl?: string;
    webHookUrl: string;
  }): Promise<MonoInvoiceCreationResult>;
  verifyWebhookSignature(rawBody: Buffer, signature: string): Promise<boolean>;
}
