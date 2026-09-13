import { describe, expect, it } from 'vitest';
import type { FinderProfileReference } from '../../contracts/recommendation';
import type { Tea } from '../../contracts/tea';
import {
  calculateBodyScore,
  calculateRecommendationScore,
  calculateTasteFit,
  classifyRecommendationBand,
  isEligibleTea,
  recommendTeas,
  RECOMMENDATION_ALGORITHM_VERSION,
  buildRecommendationReasons,
} from './engine';

const baseTea: Tea = {
  id: 'tea-a',
  slug: 'tea-a',
  name: 'Synthetic Tea A',
  family: 'family-a',
  sensory: {
    aroma: ['floral', 'honey'],
    sweetness: 70,
    body: 60,
    freshness: 80,
    roast: 20,
    depth: 30,
    astringency: 20,
    finish: 70,
    floral: 80,
    fruity: 40,
    mineral: 30,
    earthyWoody: 10,
  },
  discoveryDistance: 20,
  price: { amount: 1000 as Tea['price']['amount'], currency: 'USD' },
  packSize: 50,
  inventory: 10,
  supplyStatus: 'available',
  provenanceConfidence: 'verified',
  publishingState: 'published',
};

const profile: FinderProfileReference = {
  body: 60,
  sweetness: 70,
  freshness: 80,
  roastDepth: 25,
  aroma: ['floral'],
  familiarity: 'familiar',
  discoveryTolerance: 'open',
};

describe('recommendation engine v1', () => {
  it('calculates component scores on a bounded 0-100 scale', () => {
    expect(calculateBodyScore(profile, baseTea)).toBe(100);
    expect(calculateTasteFit(profile, baseTea)).toBe(100);
  });

  it('applies the approved weights and renormalizes only available components', () => {
    expect(calculateRecommendationScore({
      tasteFit: 80,
      body: 60,
      roastDepth: 40,
      familiarityAccessibility: 20,
      context: null,
      discoveryTolerance: 100,
    })).toBeCloseTo(65 / 0.95, 10);
    expect(calculateRecommendationScore({
      tasteFit: null,
      body: 80,
      roastDepth: null,
      familiarityAccessibility: null,
      context: null,
      discoveryTolerance: null,
    })).toBe(80);
    expect(calculateRecommendationScore({
      tasteFit: null,
      body: null,
      roastDepth: null,
      familiarityAccessibility: null,
      context: null,
      discoveryTolerance: null,
    })).toBeNull();
  });

  it('classifies every required threshold boundary exactly', () => {
    expect(classifyRecommendationBand(80)).toBe('MATCH');
    expect(classifyRecommendationBand(79)).toBe('STRETCH');
    expect(classifyRecommendationBand(65)).toBe('STRETCH');
    expect(classifyRecommendationBand(64)).toBe('WILDCARD');
    expect(classifyRecommendationBand(50)).toBe('WILDCARD');
    expect(classifyRecommendationBand(49)).toBeNull();
  });

  it('uses stable score-desc/id-asc ordering and excludes below-50 results', () => {
    const teaB = { ...baseTea, id: 'tea-b', slug: 'tea-b', name: 'Synthetic Tea B', sensory: { ...baseTea.sensory, sweetness: 69 } };
    const teaC = { ...baseTea, id: 'tea-c', slug: 'tea-c', name: 'Synthetic Tea C', sensory: { ...baseTea.sensory, sweetness: 0, freshness: 0, body: 0, roast: 100, depth: 100 }, discoveryDistance: 100 };
    const first = recommendTeas(profile, [teaC, teaB, baseTea]);
    const second = recommendTeas(profile, [baseTea, teaC, teaB]);
    expect(first).toEqual(second);
    expect(first.map((result) => result.tea.id)).toEqual(['tea-a', 'tea-b']);
    expect(first.every((result) => result.score >= 50)).toBe(true);
  });

  it('applies explicit eligibility semantics', () => {
    expect(isEligibleTea(baseTea)).toBe(true);
    expect(isEligibleTea({ ...baseTea, publishingState: 'draft' })).toBe(false);
    expect(isEligibleTea({ ...baseTea, inventory: 0 })).toBe(false);
    expect(isEligibleTea({ ...baseTea, supplyStatus: 'unavailable' })).toBe(false);
    expect(isEligibleTea({ ...baseTea, supplyStatus: 'discontinued' })).toBe(false);
  });

  it('produces deterministic explanations without generated claims', () => {
    const reasons = buildRecommendationReasons({
      tasteFit: 90,
      body: 70,
      roastDepth: 60,
      familiarityAccessibility: null,
      context: null,
      discoveryTolerance: null,
    });
    expect(reasons).toEqual([
      'Matches your preference for taste',
      'Close to your preference for body',
      'A controlled discovery step for fresh/roasted balance',
    ]);
  });

  it('is deterministic across repeated calculations and versioned', () => {
    const runs = Array.from({ length: 5 }, () => recommendTeas(profile, [baseTea]));
    expect(runs.every((run) => JSON.stringify(run) === JSON.stringify(runs[0]))).toBe(true);
    expect(runs[0][0].algorithmVersion).toBe(RECOMMENDATION_ALGORITHM_VERSION);
  });

  it('does not invent missing tea attributes', () => {
    const incomplete = { ...baseTea, sensory: { ...baseTea.sensory, aroma: [] } };
    expect(calculateTasteFit({ aroma: ['floral'] }, incomplete)).toBeNull();
  });
});
