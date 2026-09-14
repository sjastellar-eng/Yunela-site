import { request as httpRequest, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createMoney } from '../contracts/commerce';
import type { Customer, Feedback, TeaProfile } from '../contracts/account';
import type { Tea } from '../contracts/tea';
import { CustomerService } from '../application/customer/service';
import { FeedbackService } from '../application/feedback/service';
import { TeaProfileService } from '../application/profile/service';
import type { CustomerRepository, FeedbackRepository, TeaProfileRepository, TeaRepository } from '../application/repositories';
import { TeaService } from '../application/tea/service';
import { createApiServer, type ApiDependencies } from './server';
import { RecommendationApplicationService } from '../application/recommendation/service';
import { DiscoveryBoxApplicationService } from '../application/discoveryBox/service';

class FakeCustomerRepository implements CustomerRepository {
  readonly records = new Map<string, Customer>();
  create(value: Customer): void { this.records.set(value.id, value); }
  getById(id: string): Customer | undefined { return this.records.get(id); }
  update(value: Customer): Customer | undefined {
    if (!this.records.has(value.id)) return undefined;
    this.records.set(value.id, value);
    return value;
  }
}

class FakeTeaRepository implements TeaRepository {
  readonly records = new Map<string, Tea>();
  create(value: Omit<Tea, 'inventory'>): void { this.records.set(value.id, { ...value, inventory: 0 }); }
  getById(id: string): Tea | undefined { return this.records.get(id); }
  list(): Tea[] { return [...this.records.values()]; }
  update(value: Omit<Tea, 'inventory'>): Tea | undefined {
    if (!this.records.has(value.id)) return undefined;
    const updated = { ...value, inventory: this.records.get(value.id)?.inventory ?? 0 };
    this.records.set(value.id, updated);
    return updated;
  }
}

class FakeProfileRepository implements TeaProfileRepository {
  readonly records = new Map<string, TeaProfile>();
  getByCustomerId(customerId: string): TeaProfile | undefined { return this.records.get(customerId); }
  upsert(value: TeaProfile): void { this.records.set(value.customerId, value); }
}

class FakeFeedbackRepository implements FeedbackRepository {
  readonly records: Feedback[] = [];
  create(value: Feedback): void { this.records.push(value); }
  listByCustomerId(customerId: string): Feedback[] { return this.records.filter((item) => item.customerId === customerId); }
  listByTeaId(teaId: string): Feedback[] { return this.records.filter((item) => item.teaId === teaId); }
}

const taxonomy = { familyId: 'family-oolong', subfamilyId: 'subfamily-roasted', styleId: 'style-test' };
const customer: Customer = { id: 'customer-c5', email: 'c5@example.invalid', createdAt: '2026-09-14T10:00:00.000Z' };
const tea: Tea = {
  id: 'tea-c5', slug: 'tea-c5', name: 'C5 Synthetic Tea', family: taxonomy.familyId,
  subfamily: taxonomy.subfamilyId, style: taxonomy.styleId,
  sensory: { aroma: ['synthetic'], sweetness: 50, body: 50, freshness: 50, roast: 50, depth: 50, astringency: 20, finish: 50, floral: 10, fruity: 10, mineral: 10, earthyWoody: 40 },
  discoveryDistance: 20, price: createMoney(1999, 'USD'), packSize: 50, inventory: 0,
  supplyStatus: 'unknown', provenanceConfidence: 'unknown', publishingState: 'draft',
};

function buildDependencies(): ApiDependencies {
  const customers = new FakeCustomerRepository();
  const teas = new FakeTeaRepository();
  const profiles = new FakeProfileRepository();
  const feedback = new FakeFeedbackRepository();
  customers.create(customer);
  const { inventory, ...teaWrite } = tea;
  void inventory;
  teas.create(teaWrite);
  const recommendationService = new RecommendationApplicationService({ recommend: async () => [] });
  return {
    teaService: new TeaService(teas), customerService: new CustomerService(customers),
    profileService: new TeaProfileService(profiles, customers),
    feedbackService: new FeedbackService(feedback, customers, teas, profiles),
    recommendationService,
    discoveryBoxService: new DiscoveryBoxApplicationService({ recommendationService, boxRepository: { create: () => undefined, getById: () => undefined } }),
  };
}

function request(server: Server, method: string, path: string, body?: unknown): Promise<{ status: number; body: unknown }> {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server is not listening');
  return new Promise((resolve, reject) => {
    const client = httpRequest({ port: address.port, method, path, headers: body === undefined ? {} : { 'content-type': 'application/json' } }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => resolve({ status: response.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown }));
    });
    client.on('error', reject);
    if (body !== undefined) client.write(JSON.stringify(body));
    client.end();
  });
}

describe('C5 feedback → profile HTTP integration', () => {
  let server: Server | undefined;

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = undefined;
  });

  it('persists raw feedback, updates the profile, and rejects duplicate feedback without a second mutation', async () => {
    server = createApiServer({ dependencies: buildDependencies() });
    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', () => resolve()));
    const payload = {
      id: 'feedback-c5-1', customerId: customer.id, teaId: tea.id, value: 'Loved it',
      sensoryTags: [' SWEET ', 'roasted', 'deep', 'vanilla'], createdAt: '2026-09-14T10:01:00.000Z',
    };

    const first = await request(server, 'POST', '/api/v1/feedback', payload);
    expect(first.status).toBe(201);
    expect(first.body).toEqual(payload);

    const profile = await request(server, 'GET', `/api/v1/customers/${customer.id}/profile`);
    expect(profile.status).toBe(200);
    const profileBody = profile.body as { tastePreferences: unknown; feedbackIds: string[] };
    expect(profileBody.tastePreferences).toEqual({ sweetness: 60, roastDepth: 60 });
    expect(profileBody.feedbackIds).toEqual(['feedback-c5-1']);

    const duplicate = await request(server, 'POST', '/api/v1/feedback', payload);
    expect(duplicate.status).toBe(409);

    const profileAfterDuplicate = await request(server, 'GET', `/api/v1/customers/${customer.id}/profile`);
    expect((profileAfterDuplicate.body as typeof profileBody).tastePreferences).toEqual(profileBody.tastePreferences);
    expect((profileAfterDuplicate.body as typeof profileBody).feedbackIds).toEqual(['feedback-c5-1']);
  });
});
