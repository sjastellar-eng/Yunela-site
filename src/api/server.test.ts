import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { ApplicationError } from '../application/errors';
import { CustomerService } from '../application/customer/service';
import { DiscoveryBoxApplicationService } from '../application/discoveryBox/service';
import { FeedbackService } from '../application/feedback/service';
import { TeaProfileService } from '../application/profile/service';
import { NotConfiguredRecommendationEngine, RecommendationApplicationService } from '../application/recommendation/service';
import { TeaService } from '../application/tea/service';
import { SqliteCustomerRepository, SqliteDiscoveryBoxRepository, SqliteFeedbackRepository, SqliteTeaProfileRepository, SqliteTeaRepository } from '../application/sqliteRepositories';
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
  const recommendationService = new RecommendationApplicationService(new NotConfiguredRecommendationEngine());
  return {
    teaService: new TeaService(teaRepository),
    customerService: new CustomerService(customerRepository),
    profileService: new TeaProfileService(new SqliteTeaProfileRepository(db), customerRepository),
    feedbackService: new FeedbackService(new SqliteFeedbackRepository(db), customerRepository, teaRepository),
    recommendationService,
    discoveryBoxService: new DiscoveryBoxApplicationService({
      recommendationService,
      boxRepository: new SqliteDiscoveryBoxRepository(db),
    }),
  };
}

let server: Server | undefined;

function startServer(dependencies: ApiDependencies): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  server = createApiServer({ dependencies });
  return new Promise((resolve) => {
    server!.listen(0, '127.0.0.1', () => {
      const address = server!.address();
      if (!address || typeof address === 'string') throw new Error('server address unavailable');
      resolve({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((done, fail) => server!.close((error) => error ? fail(error) : done())),
      });
    });
  });
}

afterEach(() => {
  server = undefined;
});

describe('HTTP API foundation', () => {
  it('serves health', async () => {
    const db = openDatabase(':memory:');
    applyMigrations(db);
    const app = await startServer(createTestDependencies(db));
    try {
      const response = await fetch(`${app.baseUrl}/health`);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ status: 'ok', version: 'v1' });
    } finally {
      await app.close();
      db.close();
    }
  });

  it('rejects non-JSON bodies', async () => {
    const db = openDatabase(':memory:');
    applyMigrations(db);
    const app = await startServer(createTestDependencies(db));
    try {
      const response = await fetch(`${app.baseUrl}/api/v1/teas`, { method: 'POST', body: 'x', headers: { 'content-type': 'text/plain' } });
      expect(response.status).toBe(400);
    } finally {
      await app.close();
      db.close();
    }
  });

  it('rejects malformed JSON', async () => {
    const db = openDatabase(':memory:');
    applyMigrations(db);
    const app = await startServer(createTestDependencies(db));
    try {
      const response = await fetch(`${app.baseUrl}/api/v1/teas`, { method: 'POST', body: '{', headers: { 'content-type': 'application/json' } });
      expect(response.status).toBe(400);
    } finally {
      await app.close();
      db.close();
    }
  });

  it('rejects client inventory input', async () => {
    const db = openDatabase(':memory:');
    applyMigrations(db);
    const app = await startServer(createTestDependencies(db));
    try {
      const response = await fetch(`${app.baseUrl}/api/v1/teas`, { method: 'POST', body: JSON.stringify({ ...teaWritePayload('tea-inventory'), inventory: 99 }), headers: { 'content-type': 'application/json' } });
      expect(response.status).toBe(400);
    } finally {
      await app.close();
      db.close();
    }
  });

  it('returns 404 for unknown routes', async () => {
    const db = openDatabase(':memory:');
    applyMigrations(db);
    const app = await startServer(createTestDependencies(db));
    try {
      const response = await fetch(`${app.baseUrl}/api/v1/nope`);
      expect(response.status).toBe(404);
    } finally {
      await app.close();
      db.close();
    }
  });

  it('returns 405 with allow header', async () => {
    const db = openDatabase(':memory:');
    applyMigrations(db);
    const app = await startServer(createTestDependencies(db));
    try {
      const response = await fetch(`${app.baseUrl}/api/v1/teas`, { method: 'DELETE' });
      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe('GET, POST');
    } finally {
      await app.close();
      db.close();
    }
  });

  it('preserves request id', async () => {
    const db = openDatabase(':memory:');
    applyMigrations(db);
    const app = await startServer(createTestDependencies(db));
    try {
      const response = await fetch(`${app.baseUrl}/health`, { headers: { 'x-request-id': 'request-123' } });
      expect(response.headers.get('x-request-id')).toBe('request-123');
    } finally {
      await app.close();
      db.close();
    }
  });

  it('rejects invalid pagination', async () => {
    const db = openDatabase(':memory:');
    applyMigrations(db);
    const app = await startServer(createTestDependencies(db));
    try {
      const response = await fetch(`${app.baseUrl}/api/v1/teas?pageSize=51`);
      expect(response.status).toBe(400);
    } finally {
      await app.close();
      db.close();
    }
  });

  it('rejects invalid profile URL ids', async () => {
    const db = openDatabase(':memory:');
    applyMigrations(db);
    const app = await startServer(createTestDependencies(db));
    try {
      const response = await fetch(`${app.baseUrl}/api/v1/customers/%20`);
      expect(response.status).toBe(400);
    } finally {
      await app.close();
      db.close();
    }
  });

  it('does not let the transport access SQLite directly', () => {
    const source = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
    expect(source).not.toContain("from 'better-sqlite3'");
    expect(source).not.toContain("../database/");
  });

  it('maps application errors through the stable HTTP boundary', async () => {
    const db = openDatabase(':memory:');
    applyMigrations(db);
    const deps = createTestDependencies(db);
    deps.customerService = { getCustomer: () => { throw new ApplicationError('NOT_FOUND', 'missing'); } } as unknown as CustomerService;
    const app = await startServer(deps);
    try {
      const response = await fetch(`${app.baseUrl}/api/v1/customers/missing`);
      expect(response.status).toBe(404);
      expect(await response.json()).toMatchObject({ error: { code: 'NOT_FOUND', message: 'missing' } });
    } finally {
      await app.close();
      db.close();
    }
  });
});
