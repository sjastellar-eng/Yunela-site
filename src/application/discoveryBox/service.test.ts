import { describe, expect, it } from 'vitest';
import type { DiscoveryBox } from '../../contracts/discoveryBox';
import type { RecommendationResult } from '../../contracts/recommendation';
import { DiscoveryBoxApplicationService } from './service';
import type { DiscoveryBoxRepository } from '../repositories';
import type { RecommendationEngine } from '../recommendation/service';
import { RecommendationApplicationService } from '../recommendation/service';

function recommendation(id: string, classification: RecommendationResult['classification'], score: number): RecommendationResult {
  return {
    tea: { id, slug: id, name: id }, classification, score, reasons: [`reason-${id}`],
    algorithmVersion: 'recommendation-v1', profileReference: { body: 60 }, createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('DiscoveryBoxApplicationService', () => {
  it('delegates candidate generation to C3 and persists the deterministic selection', async () => {
    const results = [
      recommendation('m3', 'MATCH', 82), recommendation('m1', 'MATCH', 95), recommendation('m2', 'MATCH', 88),
      recommendation('s2', 'STRETCH', 75), recommendation('s1', 'STRETCH', 79), recommendation('w1', 'WILDCARD', 61),
    ];
    let calls = 0;
    const engine: RecommendationEngine = { recommend: async () => { calls += 1; return results; } };
    const c3 = new RecommendationApplicationService(engine);
    let persisted: DiscoveryBox | undefined;
    const repository: DiscoveryBoxRepository = {
      create: (box) => { persisted = box; },
      getById: (id) => persisted?.id === id ? persisted : undefined,
    };
    const service = new DiscoveryBoxApplicationService({ recommendationService: c3, boxRepository: repository, clock: () => '2026-01-01T00:00:00.000Z' });

    const profileReference = { body: 60, sweetness: 55, aroma: ['floral'] };
    const box = await service.createBox({ customerId: 'customer-1', profileReference });
    expect(calls).toBe(1);
    expect(box).toEqual(persisted);
    expect(box).toMatchObject({ algorithmVersion: 'recommendation-v1', selectionVersion: 'discovery-box-v1', customerId: 'customer-1', profileReference });
    expect(box.items.map((item) => item.teaId)).toEqual(['m1', 'm2', 'm3', 's1', 's2', 'w1']);
    expect(box.items.map((item) => item.reasons)).toEqual([['reason-m1'], ['reason-m2'], ['reason-m3'], ['reason-s1'], ['reason-s2'], ['reason-w1']]);
    expect(service.getBox(box.id)).toEqual(box);
  });
});
