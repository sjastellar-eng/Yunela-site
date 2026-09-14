import { describe, expect, it } from 'vitest';
import type { Feedback, TastePreferences } from '../../contracts/account';
import { rebuildTastePreferences, toFinderProfileReference } from './feedbackMapping';

const feedback = (id: string, value: Feedback['value'], sensoryTags: string[], createdAt = `2026-09-14T10:00:0${id.slice(-1)}.000Z`): Feedback => ({
  id,
  customerId: 'customer-1',
  teaId: 'tea-1',
  value,
  sensoryTags,
  createdAt,
});

describe('C5 feedback to TastePreferences mapping', () => {
  it.each([
    ['Loved it', 60],
    ['Liked it', 55],
    ['Not for me', 40],
  ] as const)('applies %s + sweet from initial 50', (value, expected) => {
    expect(rebuildTastePreferences([feedback('feedback-1', value, ['sweet'])]).sweetness).toBe(expected);
  });

  it.each([
    ['Loved it', 60],
    ['Not for me', 40],
  ] as const)('applies %s + roasted to roastDepth', (value, expected) => {
    expect(rebuildTastePreferences([feedback('feedback-1', value, ['roasted'])]).roastDepth).toBe(expected);
  });

  it('adds positive canonical aroma tags and removes them for negative feedback', () => {
    const loved = rebuildTastePreferences([feedback('feedback-1', 'Loved it', [' floral '])]);
    expect(loved.aroma).toEqual(['floral']);

    const removed = rebuildTastePreferences([
      feedback('feedback-1', 'Loved it', ['floral']),
      feedback('feedback-2', 'Not for me', ['FLORAL']),
    ]);
    expect(removed.aroma).toEqual([]);
  });

  it('supports multiple mapped dimensions in one feedback event', () => {
    const result = rebuildTastePreferences([feedback('feedback-1', 'Loved it', ['sweet', 'fresh', 'floral'])]);
    expect(result).toMatchObject({ sweetness: 60, freshness: 60, aroma: ['floral'] });
  });

  it('averages multiple tags targeting the same numeric dimension before updating', () => {
    const result = rebuildTastePreferences([feedback('feedback-1', 'Loved it', ['roasted', 'deep'])]);
    expect(result.roastDepth).toBe(60);
  });

  it('preserves unsupported tags only in raw feedback and never maps them into preferences', () => {
    const raw = feedback('feedback-1', 'Loved it', ['vanilla', 'candy', 'roasty-ish']);
    const result = rebuildTastePreferences([raw]);
    expect(result).toEqual({});
    expect(raw.sensoryTags).toEqual(['vanilla', 'candy', 'roasty-ish']);
  });

  it('does not perform synonym expansion or free-text interpretation', () => {
    const result = rebuildTastePreferences([feedback('feedback-1', 'Loved it', ['roast', 'roasting', 'sweetness', 'freshness'])]);
    expect(result).toEqual({});
  });

  it('clamps numeric preferences to 0 and 100', () => {
    const high = rebuildTastePreferences([
      ...Array.from({ length: 6 }, (_, index) => feedback(`high-${index}`, 'Loved it', ['sweet'], `2026-09-14T10:00:0${index}.000Z`)),
    ]);
    expect(high.sweetness).toBe(100);

    const low = rebuildTastePreferences([
      ...Array.from({ length: 6 }, (_, index) => feedback(`low-${index}`, 'Not for me', ['sweet'], `2026-09-14T11:00:0${index}.000Z`)),
    ]);
    expect(low.sweetness).toBe(0);
  });

  it('rebuilds deterministically from the same ordered feedback history', () => {
    const history = [
      feedback('feedback-2', 'Liked it', ['sweet'], '2026-09-14T10:00:02.000Z'),
      feedback('feedback-1', 'Loved it', ['fresh'], '2026-09-14T10:00:01.000Z'),
    ];
    expect(rebuildTastePreferences(history)).toEqual(rebuildTastePreferences([...history].reverse()));
  });

  it('maps TastePreferences into the existing FinderProfileReference shape', () => {
    const preferences: TastePreferences = {
      sweetness: 60,
      freshness: 55,
      roastDepth: 70,
      aroma: ['floral'],
    };
    expect(toFinderProfileReference(preferences)).toEqual(preferences);
  });
});
