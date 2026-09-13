import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createApiServer } from './server';
import { openDatabase } from '../database/client';
import { applyMigrations } from '../database/migrate';
import { insertCustomer, insertTea, insertTeaLot } from '../database/repositories';
import { CustomerService } from '../application/customer/service';
import { TeaService } from '../application/tea/service';
import { TeaProfileService } from '../application/profile/service';
import { FeedbackService } from '../application/feedback/service';
import { DeterministicRecommendationEngine, RecommendationApplicationService } from '../application/recommendation/service';
import { SqliteCustomerRepository, SqliteFeedbackRepository, SqliteRecommendationHistoryRepository, SqliteTeaProfileRepository, SqliteTeaRepository } from '../application/sqliteRepositories';
import type { Tea } from '../contracts/tea';

const servers: Array<{ close: () => void }> = [];
afterEach(() => { for (const item of servers.splice(0)) item.close(); });

function createFixture() {
  const db = openDatabase(':memory:');
  applyMigrations(db);
  db.prepare('INSERT INTO tea_families (id, name) VALUES (?, ?)').run('family-a', 'Synthetic Family');
  const customerId = 'customer-recommendation';
  insertCustomer(db, { id: customerId, email: 'recommendation@example.com', createdAt: '2026-01-01T00:00:00.000Z' });
  const tea: Tea = {
    id: 'tea-api', slug: 'tea-api', name: 'Synthetic API Tea', family: 'family-a',
    sensory: { aroma: ['floral'], sweetness: 70, body: 60, freshness: 80, roast: 20, depth: 30, astringency: 20, finish: 70, floral: 80, fruity: 40, mineral: 30, earthyWoody: 10 },
    discoveryDistance: 20, price: { amount: 1000 as Tea['price']['amount'], currency: 'USD' }, packSize: 50, inventory: 5,
    supplyStatus: 'available', provenanceConfidence: 'verified', publishingState: 'published',
  };
  insertTea(db, tea, { familyId: 'family-a' });
  insertTeaLot(db, { id: 'lot-api', teaId: 'tea-api', lotCode: 'SYNTHETIC-LOT-1', inventoryQuantity: 5, supplyStatus: 'available', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' });

  const teaRepository = new SqliteTeaRepository(db);
  const customerRepository = new SqliteCustomerRepository(db);
  const historyRepository = new SqliteRecommendationHistoryRepository(db);
  const recommendationService = new RecommendationApplicationService(new DeterministicRecommendationEngine(teaRepository), { customerRepository, historyRepository }, () => '2026-01-01T00:00:00.000Z');
  const server = createApiServer({ dependencies: {
    teaService: new TeaService(teaRepository),
    customerService: new CustomerService(customerRepository),
    profileService: new TeaProfileService(new SqliteTeaProfileRepository(db), customerRepository),
    feedbackService: new FeedbackService(new SqliteFeedbackRepository(db), customerRepository, teaRepository),
    recommendationService,
  } });
  return { db, server, customerId };
}

describe('POST /api/v1/recommendations', () => {
  it('executes the deterministic engine and persists the exact profile reference', async () => {
    const fixture = createFixture();
    servers.push({ close: () => { fixture.server.close(); fixture.db.close(); } });
    await new Promise<void>((resolve) => fixture.server.listen(0, '127.0.0.1', resolve));
    const address = fixture.server.address();
    if (!address || typeof address === 'string') throw new Error('server address unavailable');
    const profileReference = { body: 60, sweetness: 70, freshness: 80, roastDepth: 25, aroma: ['floral', 'fruity'], context: 'evening', familiarity: 'familiar', discoveryTolerance: 'open' };
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/recommendations`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-request-id': randomUUID() },
      body: JSON.stringify({ customerId: fixture.customerId, profileReference }),
    });
    expect(response.status).toBe(200);
    const results = await response.json() as Array<Record<string, unknown>>;
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ algorithmVersion: 'recommendation-v1', classification: 'MATCH', tea: { id: 'tea-api' } });
    const history = fixture.db.prepare('SELECT customer_id, tea_id, algorithm_version, score, classification, profile_reference_json FROM recommendation_history').all() as Array<Record<string, unknown>>;
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ customer_id: fixture.customerId, tea_id: 'tea-api', algorithm_version: 'recommendation-v1', classification: 'MATCH' });
    expect(JSON.parse(String(history[0].profile_reference_json))).toEqual(profileReference);
  });
});
