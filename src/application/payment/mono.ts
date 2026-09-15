import { createVerify } from 'node:crypto';
import type { MonoInvoiceCreationResult, MonoPaymentAdapter } from '../../contracts/payment';

export interface MonoAdapterOptions {
  baseUrl?: string;
  token?: string;
  webhookUrl: string;
  redirectUrl?: string;
  fetchImpl?: typeof fetch;
}

export class MonoAcquiringAdapter implements MonoPaymentAdapter {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly fetchImpl: typeof fetch;
  private cachedPublicKey?: string;

  constructor(private readonly options: MonoAdapterOptions) {
    this.baseUrl = (options.baseUrl ?? process.env.MONO_API_BASE_URL ?? 'https://api.monobank.ua').replace(/\/$/, '');
    this.token = options.token ?? process.env.MONO_X_TOKEN ?? '';
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async createInvoice(input: { amount: number; currency: 980; merchantReference: string; redirectUrl?: string; webHookUrl: string }): Promise<MonoInvoiceCreationResult> {
    if (!this.token) throw new Error('MONO_X_TOKEN is not configured');
    const response = await this.fetchImpl(`${this.baseUrl}/api/merchant/invoice/create`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Token': this.token },
      body: JSON.stringify({
        amount: input.amount,
        ccy: input.currency,
        merchantPaymInfo: { reference: input.merchantReference, destination: 'YUNELA tea order' },
        redirectUrl: input.redirectUrl ?? this.options.redirectUrl,
        webHookUrl: input.webHookUrl,
        paymentType: 'debit',
      }),
    });
    if (!response.ok) throw new Error(`Mono invoice creation failed with HTTP ${response.status}`);
    const payload = await response.json() as { invoiceId?: string; pageUrl?: string };
    if (!payload.invoiceId || !payload.pageUrl) throw new Error('Mono invoice response is incomplete');
    return { providerInvoiceId: payload.invoiceId, paymentPageUrl: payload.pageUrl };
  }

  async verifyWebhookSignature(rawBody: Buffer, signature: string): Promise<boolean> {
    if (!signature) return false;
    const verifyWith = (publicKeyBase64: string): boolean => {
      try {
        const publicKeyPem = Buffer.from(publicKeyBase64, 'base64').toString('utf8');
        const verifier = createVerify('SHA256');
        verifier.update(rawBody);
        verifier.end();
        return verifier.verify(publicKeyPem, Buffer.from(signature, 'base64'));
      } catch { return false; }
    };
    if (this.cachedPublicKey && verifyWith(this.cachedPublicKey)) return true;
    const refreshed = await this.fetchPublicKey();
    if (!refreshed) return false;
    return verifyWith(refreshed);
  }

  private async fetchPublicKey(): Promise<string | undefined> {
    if (!this.token) return undefined;
    const response = await this.fetchImpl(`${this.baseUrl}/api/merchant/pubkey`, { headers: { 'X-Token': this.token } });
    if (!response.ok) return undefined;
    const payload = await response.json() as { key?: string };
    if (!payload.key) return undefined;
    this.cachedPublicKey = payload.key;
    return payload.key;
  }
}
