import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { CustomerService } from '../application/customer/service';
import { DiscoveryBoxApplicationService } from '../application/discoveryBox/service';
import { FeedbackService } from '../application/feedback/service';
import { NotConfiguredRecommendationEngine, RecommendationApplicationService } from '../application/recommendation/service';
import { TeaProfileService } from '../application/profile/service';
import { TeaService } from '../application/tea/service';
import { SqliteCustomerRepository, SqliteDiscoveryBoxRepository, SqliteFeedbackRepository, SqliteRecommendationHistoryRepository, SqliteTeaProfileRepository, SqliteTeaRepository } from '../application/sqliteRepositories';
import { openDatabase } from '../database/client';
import { applyMigrations } from '../database/migrate';
import type { RecommendationEngine } from '../application/recommendation/service';
import type { RecommendationResult } from '../contracts/recommendation';
import type { ApiDependencies } from './server';
import { createApiServer } from './server';

const servers: Array<{ server: Server; db: ReturnType<typeof openDatabase> }> = [];

afterEach(async () => {
  for (const fixture of servers.splice(0)) {
    await new Promise<void>((resolve) => fixture.server.close(() => resolve()));
    fixture.db.close();
  }
});

function recommendation(id: string, classification: RecommendationResult['classification'], score: number): RecommendationResult {
  return {
    tea: { id, slug: id, name: id },
    classification,
    score,
    reasons: [`reason-${id}`],
    algorithmVersion: 'recommendation-v1',
    profileReference: { body: 60, sweetness: 55, aroma: ['floral'], context: 'evening', familiarity: 'familiar', discoveryTolerance: 'open' },
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function fixture(results: RecommendationResult[]): { db: ReturnType<typeof openDatabase>; server: Server; customerId: string } {
  const db = openDatabase(':memory:');
  applyMigrations(db);
  db.prepare('INSERT INTO tea_families (id, name) VALUES (?, ?)').run('family-c4', 'C4 Synthetic');
  const customerId = 'customer-c4';
  db.prepare('INSERT INTO customers (id, email, created_at) VALUES (?, ?, ?)').run(customerId, 'c4@example.invalid', '2026-01-01T00:00:00.000Z');

  const customerRepository = new SqliteCustomerRepository(db);
  const teaRepository = new SqliteTeaRepository(db);
  const historyRepository = new SqliteRecommendationHistoryRepository(db);
  const engine: RecommendationEngine = { recommend: async () => results };
  const recommendationService = new RecommendationApplicationService(engine, { customerRepository, historyRepository }, () => '2026-01-01T00:00:00.000Z');
  const boxRepository = new SqliteDiscoveryBoxRepository(db);
  const discoveryBoxService = new DiscoveryBoxApplicationService({ recommendationService, boxRepository, clock: () => '2026-01-01T00:00:00.000Z' });

  const dependencies: ApiDependencies = {
    teaService: new TeaService(teaRepository),
    customerService: new CustomerService(customerRepository),
    profileService: new TeaProfileService(new SqliteTeaProfileRepository(db), customerRepository),
    feedbackService: new FeedbackService(new SqliteFeedbackRepository(db), customerRepository, teaRepository),
    recommendationService,
    discoveryBoxService,
  };
  const server = createApiServer({ dependencies });
  servers.push({ server, db });
  return { db, server, customerId };
}

async function start(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server address unavailable');
  return `http://127.0.0.1:${address.port}`;
}

function completeResults(): RecommendationResult[] {
  return [
    recommendation('m3', 'MATCH', 82), recommendation('m1', 'MATCH', 95), recommendation('m2', 'MATCH', 88),
    recommendation('s2', 'STRETCH', 75), recommendation('s1', 'STRETCH', 79),
    recommendation('w1', 'WILDCARD', 61),
  ];
}

describe('Discovery Box HTTP integration', () => {
  it('creates, persists and reads back an auditable 3/2/1 box', async () => {
    const fixtureValue = fixture(completeResults());
    const base = await start(fixtureValue.server);
    const profileReference = { body: 61, sweetness: 57, freshness: 70, roastDepth: 20, aroma: ['floral', 'fruity'], context: 'evening', familiarity: 'familiar', discoveryTolerance: 'open' };
    const response = await fetch(`${base}/api/v1/discovery-boxes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-request-id': randomUUID() },
      body: JSON.stringify({ profileReference }),
    });
    expect(response.status).toBe(201);
    const box = await response.json() as Record<string, unknown>;
    expect(box).toMatchObject({ algorithmVersion: 'recommendation-v1', selectionVersion: 'discovery-box-v1', profileReference });
    expect((box.items as unknown[])).toHaveLength(6);
    expect((box.items as Array<Record<string, unknown>>).map((item) => item.teaId)).toEqual(['m1', 'm2', 'm3', 's1', 's2', 'w1']);

    const read = await fetch(`${base}/api/v1/discovery-boxes/${encodeURIComponent(String(box.id))}`);
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual(box);

    const persistedBox = fixtureValue.db.prepare('SELECT algorithm_version, selection_version, profile_reference_json, created_at FROM discovery_boxes WHERE id = ?').get(String(box.id)) as Record<string, unknown>;
    expect(persistedBox).toMatchObject({ algorithm_version: 'recommendation-v1', selection_version: 'discovery-box-v1', created_at: '2026-01-01T00:00:00.000Z' });
    expect(JSON.parse(String(persistedBox.profile_reference_json))).toEqual(profileReference);
    expect(fixtureValue.db.prepare('SELECT COUNT(*) AS count FROM discovery_box_items WHERE box_id = ?').get(String(box.id))).toEqual({ count: 6 });
  });

  it('returns a controlled 422 when a required role is insufficient', async () => {
    const fixtureValue = fixture([
      recommendation('m1', 'MATCH', 90), recommendation('m2', 'MATCH', 89),
      recommendation('s1', 'STRETCH', 70), recommendation('s2', 'STRETCH', 69), recommendation('w1', 'WILDCARD', 60),
    ]);
    const base = await start(fixtureValue.server);
    const response = await fetch(`${base}/api/v1/discovery-boxes`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profileReference: { body: 50 } }),
    });
    expect(response.status).toBe(422);
    expect((await response.json() as { error: { code: string } }).error.code).toBe('DISCOVERY_BOX_INSUFFICIENT_CANDIDATES');
    expect(fixtureValue.db.prepare('SELECT COUNT(*) AS count FROM discovery_boxes').get()).toEqual({ count: 0 });
  });

  it('keeps HTTP transport free of SQLite and selection logic', () => {
    const source = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
    expect(source).not.toContain('better-sqlite3');
    expect(source).not.toContain('selectDiscoveryBoxItems');
    expect(source).not.toContain('score DESC');
  });

  it('keeps the C2 recommendation endpoint independently routed', async () => {
    const db = openDatabase(':memory:');
    applyMigrations(db);
    const recommendationService = new RecommendationApplicationService(new NotConfiguredRecommendationEngine());
    const discoveryBoxService = new DiscoveryBoxApplicationService({ recommendationService, boxRepository: new SqliteDiscoveryBoxRepository(db) });
    const teaRepository = new SqliteTeaRepository(db);
    const customerRepository = new SqliteCustomerRepository(db);
    const server = createApiServer({ dependencies: {
      teaService: new TeaService(teaRepository),
      customerService: new CustomerService(customerRepository),
      profileService: new TeaProfileService(new SqliteTeaProfileRepository(db), customerRepository),
      feedbackService: new FeedbackService(new SqliteFeedbackRepository(db), customerRepository, teaRepository),
      recommendationService,
      discoveryBoxService,
    } });
    servers.push({ server, db });
    const base = await start(server);
    const response = await fetch(`${base}/api/v1/recommendations`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ profileReference: { body: 50 } }) });
    expect(response.status).toBe(501);
  });
});
