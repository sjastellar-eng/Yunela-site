import { afterEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { applyMigrations } from '../database/migrate';
import { openDatabase } from '../database/client';
import { CustomerService } from '../application/customer/service';
import { DiscoveryBoxApplicationService } from '../application/discoveryBox/service';
import { FeedbackService } from '../application/feedback/service';
import { TeaProfileService } from '../application/profile/service';
import { NotConfiguredRecommendationEngine, RecommendationApplicationService } from '../application/recommendation/service';
import { TeaService } from '../application/tea/service';
import { SqliteCustomerRepository, SqliteDiscoveryBoxRepository, SqliteFeedbackRepository, SqliteTeaProfileRepository, SqliteTeaRepository } from '../application/sqliteRepositories';
import type { TeaTaxonomyReference, TeaWriteInput } from '../application/repositories';
import { createMoney } from '../contracts/commerce';
import { createApiServer, type ApiDependencies } from './server';

const taxonomy: TeaTaxonomyReference = {
  familyId: 'family-oolong',
  subfamilyId: 'subfamily-roasted',
  styleId: 'style-test',
};

function teaInput(id: string): TeaWriteInput {
  return {
    id,
    slug: id,
    name: 'D1.1 Test Tea',
    family: taxonomy.familyId,
    subfamily: taxonomy.subfamilyId,
    style: taxonomy.styleId,
    sensory: {
      aroma: ['orchid'], sweetness: 50, body: 60, freshness: 30, roast: 70, depth: 65,
      astringency: 20, finish: 60, floral: 40, fruity: 20, mineral: 20, earthyWoody: 50,
    },
    discoveryDistance: 20,
    price: createMoney(1999, 'USD'),
    packSize: 50,
    supplyStatus: 'available',
    provenanceConfidence: 'unknown',
    publishingState: 'draft',
  };
}

function createTestDependencies(db: ReturnType<typeof openDatabase>): ApiDependencies {
  const teaRepository = new SqliteTeaRepository(db);
  const customerRepository = new SqliteCustomerRepository(db);
  const profileRepository = new SqliteTeaProfileRepository(db);
  const recommendationService = new RecommendationApplicationService(new NotConfiguredRecommendationEngine());
  return {
    teaService: new TeaService(teaRepository),
    customerService: new CustomerService(customerRepository),
    profileService: new TeaProfileService(profileRepository, customerRepository),
    feedbackService: new FeedbackService(new SqliteFeedbackRepository(db), customerRepository, teaRepository, profileRepository),
    recommendationService,
    discoveryBoxService: new DiscoveryBoxApplicationService({
      recommendationService,
      boxRepository: new SqliteDiscoveryBoxRepository(db),
    }),
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

async function json(response: Response): Promise<unknown> {
  return response.json();
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
  dependencies.teaService.createTea(teaInput('d1-1-tea'), taxonomy);
  closeDatabase = () => db.close();
  return { db, dependencies };
}

describe('D1.1 anonymous customer identity', () => {
  it('creates a server-owned customer id, persists it, and supports returning lookup', async () => {
    const { db, dependencies } = setupDatabase();
    const base = await startApi(dependencies);

    const create = await fetch(`${base}/api/v1/customers`, { method: 'POST' });
    expect(create.status).toBe(201);
    const created = await json(create) as { customerId: string };
    expect(created.customerId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

    const stored = db.prepare('SELECT id FROM customers WHERE id = ?').get(created.customerId) as { id: string } | undefined;
    expect(stored?.id).toBe(created.customerId);

    const returning = await fetch(`${base}/api/v1/customers/${created.customerId}`);
    expect(returning.status).toBe(200);
    expect((await json(returning) as { id: string }).id).toBe(created.customerId);
  });

  it('does not accept a client-supplied identity and allows the created customer to participate in profile and feedback flows', async () => {
    const { dependencies } = setupDatabase();
    const base = await startApi(dependencies);

    const create = await fetch(`${base}/api/v1/customers`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'client-invented-id', email: 'client@example.invalid' }),
    });
    expect(create.status).toBe(201);
    const created = await json(create) as { customerId: string };
    expect(created.customerId).not.toBe('client-invented-id');

    const now = new Date().toISOString();
    const profile = await fetch(`${base}/api/v1/customers/${created.customerId}/profile`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customerId: created.customerId,
        purchasedTeaIds: [],
        likedTeaIds: [],
        dislikedTeaIds: [],
        tastePreferences: {},
        feedbackIds: [],
        recommendationIds: [],
        updatedAt: now,
      }),
    });
    expect(profile.status).toBe(201);
    expect((await json(profile) as { customerId: string }).customerId).toBe(created.customerId);

    const feedback = await fetch(`${base}/api/v1/feedback`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: 'd1-1-feedback',
        customerId: created.customerId,
        teaId: 'd1-1-tea',
        value: 'Liked it',
        sensoryTags: ['sweet'],
        createdAt: now,
      }),
    });
    expect(feedback.status).toBe(201);
    expect((await json(feedback) as { customerId: string }).customerId).toBe(created.customerId);

    const storedProfile = await fetch(`${base}/api/v1/customers/${created.customerId}/profile`);
    expect(storedProfile.status).toBe(200);
    expect((await json(storedProfile) as { feedbackIds: string[] }).feedbackIds).toEqual(['d1-1-feedback']);
  });

  it('rejects lookup of an unknown customer id', async () => {
    const { dependencies } = setupDatabase();
    const base = await startApi(dependencies);
    const response = await fetch(`${base}/api/v1/customers/00000000-0000-4000-8000-000000000000`);
    expect(response.status).toBe(404);
    expect((await json(response) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });

  it('allows only POST on the customer collection and only GET on a customer resource', async () => {
    const { dependencies } = setupDatabase();
    const base = await startApi(dependencies);
    const collectionGet = await fetch(`${base}/api/v1/customers`);
    expect(collectionGet.status).toBe(405);
    expect(collectionGet.headers.get('allow')).toBe('POST');

    const create = await fetch(`${base}/api/v1/customers`, { method: 'POST' });
    const { customerId } = await json(create) as { customerId: string };
    const resourcePost = await fetch(`${base}/api/v1/customers/${customerId}`, { method: 'POST' });
    expect(resourcePost.status).toBe(405);
    expect(resourcePost.headers.get('allow')).toBe('GET');
  });
});
