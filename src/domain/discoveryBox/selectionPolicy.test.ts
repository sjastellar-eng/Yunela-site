import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DiscoveryBoxSelectionFailure, selectDiscoveryBoxItems } from './selectionPolicy';
import type { RecommendationResult } from '../../contracts/recommendation';

function recommendation(id: string, classification: RecommendationResult['classification'], score: number): RecommendationResult {
  return {
    tea: { id, slug: id, name: id },
    classification,
    score,
    reasons: [`reason-${id}`],
    algorithmVersion: 'recommendation-v1',
    profileReference: { body: 60, sweetness: 50 },
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('Discovery Box selection policy', () => {
  it('has no application-layer dependency', () => {
    const source = readFileSync(new URL('./selectionPolicy.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from ['"]\.\.?\/.*application\//);
    expect(source).not.toContain('/application/');
    expect(source).not.toContain('ApplicationError');
  });

  it('selects exactly 3 MATCH, 2 STRETCH and 1 WILDCARD in deterministic order', () => {
    const results = [
      recommendation('m3', 'MATCH', 82), recommendation('m1', 'MATCH', 95), recommendation('m2', 'MATCH', 88), recommendation('m4', 'MATCH', 81),
      recommendation('s2', 'STRETCH', 75), recommendation('s1', 'STRETCH', 79), recommendation('s3', 'STRETCH', 70),
      recommendation('w1', 'WILDCARD', 61), recommendation('w2', 'WILDCARD', 55),
    ];
    const items = selectDiscoveryBoxItems(results);
    expect(items).toHaveLength(6);
    expect(items.map((item) => item.teaId)).toEqual(['m1', 'm2', 'm3', 's1', 's2', 'w1']);
    expect(items.map((item) => item.classification)).toEqual(['MATCH', 'MATCH', 'MATCH', 'STRETCH', 'STRETCH', 'WILDCARD']);
    expect(items.map((item) => item.position)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('uses tea ID ascending as the tie-break', () => {
    const items = selectDiscoveryBoxItems([
      recommendation('m-c', 'MATCH', 90), recommendation('m-a', 'MATCH', 90), recommendation('m-b', 'MATCH', 90), recommendation('m-d', 'MATCH', 80),
      recommendation('s-b', 'STRETCH', 70), recommendation('s-a', 'STRETCH', 70), recommendation('w-a', 'WILDCARD', 60),
    ]);
    expect(items.slice(0, 3).map((item) => item.teaId)).toEqual(['m-a', 'm-b', 'm-c']);
    expect(items.slice(3, 5).map((item) => item.teaId)).toEqual(['s-a', 's-b']);
  });

  it('produces the same output for the same input', () => {
    const results = [
      recommendation('m3', 'MATCH', 82), recommendation('m1', 'MATCH', 95), recommendation('m2', 'MATCH', 88),
      recommendation('s2', 'STRETCH', 75), recommendation('s1', 'STRETCH', 79),
      recommendation('w1', 'WILDCARD', 61),
    ];
    expect(selectDiscoveryBoxItems(results)).toEqual(selectDiscoveryBoxItems(results));
  });

  it('does not allow duplicate tea IDs to satisfy a role or appear twice', () => {
    const items = selectDiscoveryBoxItems([
      recommendation('m1', 'MATCH', 95), recommendation('m1', 'MATCH', 94), recommendation('m2', 'MATCH', 90), recommendation('m3', 'MATCH', 85),
      recommendation('s1', 'STRETCH', 79), recommendation('s2', 'STRETCH', 70),
      recommendation('w1', 'WILDCARD', 60),
    ]);
    expect(items.map((item) => item.teaId)).toEqual(['m1', 'm2', 'm3', 's1', 's2', 'w1']);
    expect(new Set(items.map((item) => item.teaId)).size).toBe(6);
  });

  it('fails explicitly with structured role details without substitution', () => {
    expect(() => selectDiscoveryBoxItems([
      recommendation('m1', 'MATCH', 90), recommendation('m2', 'MATCH', 89),
      recommendation('s1', 'STRETCH', 70), recommendation('w1', 'WILDCARD', 60),
    ])).toThrowError(DiscoveryBoxSelectionFailure);

    try {
      selectDiscoveryBoxItems([
        recommendation('m1', 'MATCH', 90), recommendation('m2', 'MATCH', 89),
        recommendation('s1', 'STRETCH', 70), recommendation('w1', 'WILDCARD', 60),
      ]);
    } catch (error) {
      expect(error).toMatchObject({ details: [{ role: 'MATCH', required: 3, available: 2 }] });
    }
  });

  it('does not let a duplicate ID across malformed classifications enter the box twice', () => {
    const items = selectDiscoveryBoxItems([
      recommendation('shared', 'MATCH', 95), recommendation('m2', 'MATCH', 90), recommendation('m3', 'MATCH', 85),
      recommendation('s1', 'STRETCH', 80), recommendation('s2', 'STRETCH', 70),
      recommendation('shared', 'WILDCARD', 60), recommendation('w1', 'WILDCARD', 55),
    ]);
    expect(items.map((item) => item.teaId)).toEqual(['shared', 'm2', 'm3', 's1', 's2', 'w1']);
  });
});
