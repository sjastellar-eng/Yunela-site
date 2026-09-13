import { describe, expect, it } from 'vitest';
import {
  RECOMMENDATION_WEIGHTS,
  classifyRecommendation,
} from './recommendation';
import { createAnalyticsTracker } from './analytics';
import { createMoney } from './commerce';

describe('recommendation contract', () => {
  it('keeps the approved weights at 100%', () => {
    const total = Object.values(RECOMMENDATION_WEIGHTS).reduce(
      (sum, weight) => sum + weight,
      0,
    );

    expect(total).toBe(1);
  });

  it('preserves the approved classification boundaries', () => {
    expect(classifyRecommendation(80)).toBe('MATCH');
    expect(classifyRecommendation(79.99)).toBe('STRETCH');
    expect(classifyRecommendation(65)).toBe('STRETCH');
    expect(classifyRecommendation(64.99)).toBe('WILDCARD');
    expect(classifyRecommendation(50)).toBe('WILDCARD');
    expect(classifyRecommendation(49.99)).toBeNull();
  });
});

describe('analytics contract', () => {
  it('forwards event and payload to the provider-neutral sink', () => {
    const calls: Array<{ event: string; payload: Record<string, unknown> }> = [];
    const tracker = createAnalyticsTracker((event, payload) => {
      calls.push({ event, payload });
    });

    tracker.track('finder_complete', { questionCount: 7, completed: true });

    expect(calls).toEqual([
      {
        event: 'finder_complete',
        payload: { questionCount: 7, completed: true },
      },
    ]);
  });
});

describe('money contract', () => {
  it('uses integer minor units and validates currency format', () => {
    expect(createMoney(1999, 'USD')).toEqual({ amount: 1999, currency: 'USD' });
    expect(() => createMoney(19.99, 'USD')).toThrow(/integer/);
    expect(() => createMoney(1999, 'usd')).toThrow(/ISO 4217/);
  });
});
