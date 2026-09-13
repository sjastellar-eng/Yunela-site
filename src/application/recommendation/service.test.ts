import { describe, expect, it } from 'vitest';
import type { Customer, RecommendationHistoryEntry } from '../../contracts/account';
import type { RecommendationRequest } from '../../contracts/recommendation';
import type { Tea } from '../../contracts/tea';
import type { CustomerRepository, RecommendationHistoryRepository, TeaRepository } from '../repositories';
import { DeterministicRecommendationEngine, RecommendationApplicationService } from './service';

const tea: Tea = {
  id: 'tea-service',
  slug: 'tea-service',
  name: 'Synthetic Service Tea',
  family: 'family-a',
  sensory: {
    aroma: ['floral'], sweetness: 70, body: 60, freshness: 80, roast: 20, depth: 30,
    astringency: 20, finish: 70, floral: 80, fruity: 40, mineral: 30, earthyWoody: 10,
  },
  discoveryDistance: 20,
  price: { amount: 1000 as Tea['price']['amount'], currency: 'USD' },
  packSize: 50,
  inventory: 5,
  supplyStatus: 'available',
  provenanceConfidence: 'verified',
  publishingState: 'published',
};

class FakeTeaRepository implements TeaRepository {
  constructor(private readonly teas: Tea[]) {}
  create(): void { throw new Error('not used'); }
  getById(id: string): Tea | undefined { return this.teas.find((item) => item.id === id); }
  list(): Tea[] { return this.teas; }
  update(): Tea | undefined { throw new Error('not used'); }
}

class FakeCustomerRepository implements CustomerRepository {
  constructor(private readonly customer: Customer) {}
  create(): void { throw new Error('not used'); }
  getById(id: string): Customer | undefined { return id === this.customer.id ? this.customer : undefined; }
  update(): Customer | undefined { throw new Error('not used'); }
}

class FakeHistoryRepository implements RecommendationHistoryRepository {
  entries: RecommendationHistoryEntry[] = [];
  create(entry: RecommendationHistoryEntry): void { this.entries.push(entry); }
}

const request: RecommendationRequest = {
  customerId: 'customer-1',
  profileReference: {
    body: 60,
    sweetness: 70,
    freshness: 80,
    roastDepth: 25,
    aroma: ['floral'],
    familiarity: 'familiar',
    discoveryTolerance: 'open',
  },
};

describe('RecommendationApplicationService', () => {
  it('executes the engine and persists recommendation history with a stable algorithm version', async () => {
    const teaRepository = new FakeTeaRepository([tea]);
    const historyRepository = new FakeHistoryRepository();
    const service = new RecommendationApplicationService(
      new DeterministicRecommendationEngine(teaRepository),
      {
        teaRepository,
        customerRepository: new FakeCustomerRepository({ id: 'customer-1', email: 'test@example.com', createdAt: '2026-01-01T00:00:00.000Z' }),
        historyRepository,
      },
      () => '2026-01-01T00:00:00.000Z',
    );

    const results = await service.recommend(request);
    expect(results).toHaveLength(1);
    expect(results[0].algorithmVersion).toBe('recommendation-v1');
    expect(results[0].createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(historyRepository.entries).toHaveLength(1);
    expect(historyRepository.entries[0]).toMatchObject({
      customerId: 'customer-1',
      teaId: 'tea-service',
      algorithmVersion: 'recommendation-v1',
      classification: results[0].classification,
      score: results[0].score,
      explanation: results[0].reasons,
    });
  });

  it('returns NOT_FOUND when a supplied customer does not exist', async () => {
    const teaRepository = new FakeTeaRepository([tea]);
    const service = new RecommendationApplicationService(
      new DeterministicRecommendationEngine(teaRepository),
      {
        teaRepository,
        customerRepository: new FakeCustomerRepository({ id: 'other', email: 'other@example.com', createdAt: '2026-01-01T00:00:00.000Z' }),
        historyRepository: new FakeHistoryRepository(),
      },
      () => '2026-01-01T00:00:00.000Z',
    );

    await expect(service.recommend(request)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
