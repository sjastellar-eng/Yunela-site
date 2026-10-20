import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { MonoPaymentAdapter } from '../../contracts/payment';

/** Offline provider: uses the real PaymentService and persistence, never contacts a bank. */
export class TestMonoAdapter implements MonoPaymentAdapter {
  constructor(private readonly secret: string) {}
  async createInvoice() {
    const id = `test-${randomUUID()}`;
    return { providerInvoiceId: id, paymentPageUrl: `/#/test-payment/${id}` };
  }
  sign(body: Buffer): string { return createHmac('sha256', this.secret).update(body).digest('hex'); }
  async verifyWebhookSignature(body: Buffer, signature: string): Promise<boolean> {
    const expected = Buffer.from(this.sign(body));
    const actual = Buffer.from(signature);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
