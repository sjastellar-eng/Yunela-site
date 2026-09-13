import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { ApplicationError } from '../application/errors';
import { CustomerService } from '../application/customer/service';
import { FeedbackService } from '../application/feedback/service';
import { TeaProfileService } from '../application/profile/service';
import { NotConfiguredRecommendationEngine, RecommendationApplicationService } from '../application/recommendation/service';
import { TeaService } from '../application/tea/service';
import { SqliteCustomerRepository, SqliteFeedbackRepository, SqliteTeaProfileRepository, SqliteTeaRepository } from '../application/sqliteRepositories';
import type { TeaTaxonomyReference, TeaWriteInput } from '../application/repositories';
import { applyMigrations } from '../database/migrate';
import { openDatabase } from '../database/client';
import { createApiServer, type ApiDependencies } from './server';

const taxonomy: TeaTaxonomyReference = {
  familyId: 'family-oolong',
  subfamilyId: 'subfamily-roasted',
  styleId: 'style-test',
};

const teaWritePayload = (id: string) => ({
  id,
  slug: id,
  name: 'API Test Tea',
  family: taxonomy.familyId,
  subfamily: taxonomy.subfamilyId,
  style: taxonomy.styleId,
  sensory: {
    aroma: ['orchid'], sweetness: 50, body: 60, freshness: 30, roast: 70, depth: 65,
    astringency: 20, finish: 60, floral: 40, fruity: 20, mineral: 20, earthyWoody: 50,
  },
  discoveryDistance: 20,
  price: { amount: 1999, currency: 'USD' },
  packSize: 50,
  supplyStatus: 'available',
  provenanceConfidence: 'unknown',
  publishingState: 'draft',
  taxonomy,
});

function teaInput(id: string): TeaWriteInput {
  const { taxonomy: taxonomyValue, ...tea } = teaWritePayload(id);
  void taxonomyValue;
  return tea as TeaWriteInput;
}

function createTestDependencies(db: ReturnType<typeof openDatabase>): ApiDependencies {
  const teaRepository = new SqliteTeaRepository(db);
  const customerRepository = new SqliteCustomerRepository(db);
  return {
    teaService: new TeaService(teaRepository),
    customerService: new CustomerService(customerRepository),
    profileService: new TeaProfileService(new SqliteTeaProfileRepository(db), customerRepository),
    feedbackService: new FeedbackService(new SqliteFeedbackRepository(db), customerRepository, teaRepository),
    recommendationService: new RecommendationApplicationService(new NotConfiguredRecommendationEngine()),
  };
}

let server: Server | undefined;
let closeDatabase: (() => void) | undefined;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = undefined;
  }
  closeDatabase?.();
  closeDatabase = undefined;
});

async function startApi(dependencies: ApiDependencies): Promise<string> {
  server = createApiServer({ dependencies });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose an address');
  return `http://127.0.0.1:${address.port}`;
}

async function request(base: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${base}${path}`, init);
}

async function json(response: Response): Promise<unknown> {
  return response.json();
}

function jsonBody(value: unknown): RequestInit {
  return { headers: { 'content-type': 'application/json' }, body: JSON.stringify(value) };
}

function setupDatabase(): { db: ReturnType<typeof openDatabase>; dependencies: ApiDependencies } {
  const db = openDatabase(':memory:');
  applyMigrations(db);
  db.exec(`
    INSERT INTO tea_families (id, name) VALUES ('family-oolong', 'Oolong');
    INSERT INTO tea_subfamilies (id, family_id, name) VALUES ('subfamily-roasted', 'family-oolong', 'Roasted');
    INSERT INTO tea_styles (id, subfamily_id, name) VALUES ('style-test', 'subfamily-roasted', 'Test Style');
  `);
  const dependencies = createTestDependencies(db);
  closeDatabase = () => db.close();
  return { db, dependencies };
}

describe('C2 HTTP API boundary', () => {
  it('starts a server and exposes health with a request id', async () => {
    const { dependencies } = setupDatabase();
    const base = await startApi(dependencies);
    const response = await request(base, '/health', { headers: { 'x-request-id': 'req-health' } });
    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toBe('req-health');
    expect(await json(response)).toEqual({ status: 'ok', service: 'yunela-api', version: 'v1' });
  });

  it('supports GET tea list and GET tea by id', async () => {
    const { dependencies } = setupDatabase();
    dependencies.teaService.createTea(teaInput('tea-1'), taxonomy);
    const base = await startApi(dependencies);
    const list = await request(base, '/api/v1/teas?page=1&pageSize=10');
    expect(list.status).toBe(200);
    expect((await json(list) as { items: unknown[] }).items).toHaveLength(1);
    const item = await request(base, '/api/v1/teas/tea-1');
    expect(item.status).toBe(200);
    expect((await json(item) as { id: string }).id).toBe('tea-1');
  });

  it('supports POST and PATCH tea and rejects inventory as an authoritative write', async () => {
    const { dependencies } = setupDatabase();
    const base = await startApi(dependencies);
    const createResponse = await request(base, '/api/v1/teas', { method: 'POST', ...jsonBody(teaWritePayload('tea-2')) });
    expect(createResponse.status).toBe(201);
    expect((await json(createResponse) as { inventory: number }).inventory).toBe(0);

    const patchResponse = await request(base, '/api/v1/teas/tea-2', {
      method: 'PATCH',
      ...jsonBody({ ...teaWritePayload('tea-2'), name: 'Updated API Test Tea' }),
    });
    expect(patchResponse.status).toBe(200);
    expect((await json(patchResponse) as { name: string }).name).toBe('Updated API Test Tea');

    const inventoryResponse = await request(base, '/api/v1/teas', {
      method: 'POST',
      ...jsonBody({ ...teaWritePayload('tea-3'), inventory: 999 }),
    });
    expect(inventoryResponse.status).toBe(400);
    expect((await json(inventoryResponse) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('maps taxonomy validation and not-found to stable API errors', async () => {
    const { dependencies } = setupDatabase();
    const base = await startApi(dependencies);
    const mismatch = await request(base, '/api/v1/teas', {
      method: 'POST',
      ...jsonBody({ ...teaWritePayload('tea-4'), taxonomy: { ...taxonomy, familyId: 'family-other' } }),
    });
    expect(mismatch.status).toBe(400);
    expect((await json(mismatch) as { error: { code: string; requestId: string } }).error.code).toBe('VALIDATION_ERROR');

    const missing = await request(base, '/api/v1/teas/missing-tea', { headers: { 'x-request-id': 'req-missing' } });
    expect(missing.status).toBe(404);
    expect(await json(missing)).toEqual({ error: { code: 'NOT_FOUND', message: 'Tea missing-tea was not found', requestId: 'req-missing' } });
  });

  it('maps conflict and domain-rule errors without leaking internals', async () => {
    const { dependencies } = setupDatabase();
    const base = await startApi(dependencies);
    const first = await request(base, '/api/v1/teas', { method: 'POST', ...jsonBody(teaWritePayload('tea-5')) });
    expect(first.status).toBe(201);
    const duplicate = await request(base, '/api/v1/teas', { method: 'POST', ...jsonBody(teaWritePayload('tea-5')) });
    expect(duplicate.status).toBe(409);

    const original = dependencies.recommendationService.recommend.bind(dependencies.recommendationService);
    dependencies.recommendationService.recommend = async () => {
      throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'synthetic domain rule');
    };
    const domainResponse = await request(base, '/api/v1/recommendations', {
      method: 'POST',
      ...jsonBody({ profileReference: { body: 50 } }),
    });
    expect(domainResponse.status).toBe(422);
    const domainBody = await json(domainResponse) as { error: { code: string; message: string; requestId: string } };
    expect(domainBody.error).toMatchObject({ code: 'DOMAIN_RULE_VIOLATION', message: 'synthetic domain rule' });
    expect(domainBody.error.requestId).toBeTruthy();
    dependencies.recommendationService.recommend = original;
  });

  it('supports customer retrieval and profile create/read/update through application services', async () => {
    const { dependencies } = setupDatabase();
    dependencies.teaService.createTea(teaInput('tea-6'), taxonomy);
    dependencies.customerService.createCustomer({ id: 'customer-1', email: 'customer@example.invalid', createdAt: new Date().toISOString() });
    const base = await startApi(dependencies);

    const customer = await request(base, '/api/v1/customers/customer-1');
    expect(customer.status).toBe(200);
    expect((await json(customer) as { id: string }).id).toBe('customer-1');

    const createProfile = await request(base, '/api/v1/customers/customer-1/profile', {
      method: 'POST',
      ...jsonBody({ customerId: 'customer-1', purchasedTeaIds: [], likedTeaIds: ['tea-6'], dislikedTeaIds: [], tastePreferences: { body: 60 }, feedbackIds: [], recommendationIds: [], updatedAt: new Date().toISOString() }),
    });
    expect(createProfile.status).toBe(201);
    const patchProfile = await request(base, '/api/v1/customers/customer-1/profile', {
      method: 'PATCH',
      ...jsonBody({ customerId: 'customer-1', purchasedTeaIds: [], likedTeaIds: [], dislikedTeaIds: ['tea-6'], tastePreferences: { body: 40 }, feedbackIds: [], recommendationIds: [], updatedAt: new Date().toISOString() }),
    });
    expect(patchProfile.status).toBe(200);
    const profile = await request(base, '/api/v1/customers/customer-1/profile');
    expect(profile.status).toBe(200);
    expect((await json(profile) as { dislikedTeaIds: string[] }).dislikedTeaIds).toEqual(['tea-6']);

    const feedback = await request(base, '/api/v1/feedback', {
      method: 'POST',
      ...jsonBody({ id: 'feedback-1', customerId: 'customer-1', teaId: 'tea-6', value: 'Loved it', sensoryTags: ['sweet'], createdAt: new Date().toISOString() }),
    });
    expect(feedback.status).toBe(201);
  });

  it('returns 501 for the unconfigured recommendation engine', async () => {
    const { dependencies } = setupDatabase();
    const base = await startApi(dependencies);
    const response = await request(base, '/api/v1/recommendations', {
      method: 'POST',
      ...jsonBody({ profileReference: { body: 50 }, candidateTeaIds: ['tea-1'] }),
    });
    expect(response.status).toBe(501);
    const body = await json(response) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
    expect(body.error.message).toContain('deferred to Stage C3');
  });

  it('rejects malformed JSON, invalid pagination, unknown routes and non-v1 API paths', async () => {
    const { dependencies } = setupDatabase();
    const base = await startApi(dependencies);
    const malformed = await request(base, '/api/v1/teas', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{bad',
    });
    expect(malformed.status).toBe(400);
    expect((await json(malformed) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');

    const invalidPage = await request(base, '/api/v1/teas?page=0&pageSize=1000');
    expect(invalidPage.status).toBe(400);

    const unknown = await request(base, '/api/v1/unknown');
    expect(unknown.status).toBe(404);
    const v2 = await request(base, '/api/v2/teas');
    expect(v2.status).toBe(404);
  });

  it('rejects unsupported methods with an explicit Allow header', async () => {
    const { dependencies } = setupDatabase();
    const base = await startApi(dependencies);
    const response = await request(base, '/api/v1/teas', { method: 'DELETE' });
    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET, POST');
  });

  it('keeps the HTTP transport independent from SQLite implementation', () => {
    const source = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
    expect(source).not.toContain('sqliteRepositories');
    expect(source).not.toMatch(/\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b/);
  });
});
