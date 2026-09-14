import type { Feedback, TastePreferences } from '../../contracts/account';
import type { FinderProfileReference } from '../../contracts/recommendation';

type NumericDimension = 'sweetness' | 'freshness' | 'roastDepth';

export const CANONICAL_SENSORY_TAG_MAP: Record<string, { dimension: string; value?: string }> = {
  floral: { dimension: 'aroma', value: 'floral' }, fruity: { dimension: 'aroma', value: 'fruity' },
  mineral: { dimension: 'aroma', value: 'mineral' }, earthy: { dimension: 'aroma', value: 'earthy' },
  woody: { dimension: 'aroma', value: 'woody' }, creamy: { dimension: 'aroma', value: 'creamy' },
  fresh: { dimension: 'freshness' }, sweet: { dimension: 'sweetness' },
  roasted: { dimension: 'roastDepth' }, deep: { dimension: 'roastDepth' },
};

const NUMERIC_TAGS: Record<NumericDimension, string[]> = {
  sweetness: ['sweet'],
  freshness: ['fresh'],
  roastDepth: ['roasted', 'deep'],
};
const AROMA_TAGS = ['floral', 'fruity', 'mineral', 'earthy', 'woody', 'creamy'] as const;
const FEEDBACK_SIGNAL: Record<Feedback['value'], number> = { 'Loved it': 10, 'Liked it': 5, 'Not for me': -10 };
const INITIAL_NUMERIC_PREFERENCE = 50;
const MIN_PREFERENCE = 0;
const MAX_PREFERENCE = 100;

function normalizeTag(tag: string): string { return tag.trim().toLowerCase(); }
function clamp(value: number): number { return Math.max(MIN_PREFERENCE, Math.min(MAX_PREFERENCE, value)); }

function applyNumericSignals(preferences: TastePreferences, feedback: Feedback, normalizedTags: string[]): void {
  const signal = FEEDBACK_SIGNAL[feedback.value];
  for (const dimension of Object.keys(NUMERIC_TAGS) as NumericDimension[]) {
    const contributions = NUMERIC_TAGS[dimension]
      .filter((tag) => normalizedTags.includes(tag))
      .map(() => signal);
    if (contributions.length === 0) continue;
    const current = preferences[dimension] ?? INITIAL_NUMERIC_PREFERENCE;
    const averagedSignal = contributions.reduce((sum, value) => sum + value, 0) / contributions.length;
    preferences[dimension] = clamp(current + averagedSignal);
  }
}

function applyAromaSignals(preferences: TastePreferences, feedback: Feedback, normalizedTags: string[]): void {
  const mappedAromaValues = AROMA_TAGS.filter((tag) => normalizedTags.includes(tag));
  if (mappedAromaValues.length === 0 && preferences.aroma === undefined) return;
  const current = new Set((preferences.aroma ?? []).map(normalizeTag).filter(Boolean));
  const isPositive = feedback.value === 'Loved it' || feedback.value === 'Liked it';
  for (const value of mappedAromaValues) {
    if (isPositive) current.add(value);
    else current.delete(value);
  }
  preferences.aroma = [...current].sort();
}

export function applyFeedbackToTastePreferences(preferences: TastePreferences, feedback: Feedback): TastePreferences {
  const next: TastePreferences = { ...preferences, ...(preferences.aroma ? { aroma: [...preferences.aroma] } : {}) };
  const normalizedTags = feedback.sensoryTags.map(normalizeTag);
  applyNumericSignals(next, feedback, normalizedTags);
  applyAromaSignals(next, feedback, normalizedTags);
  return next;
}

export function rebuildTastePreferences(feedbackHistory: Feedback[]): TastePreferences {
  const preferences: TastePreferences = {};
  const ordered = [...feedbackHistory].sort((a, b) => {
    const createdAtOrder = a.createdAt.localeCompare(b.createdAt);
    return createdAtOrder !== 0 ? createdAtOrder : a.id.localeCompare(b.id);
  });
  for (const feedback of ordered) applyFeedbackToTastePreferences(preferences, feedback);
  return preferences;
}

export function toFinderProfileReference(preferences: TastePreferences): FinderProfileReference {
  return {
    ...(preferences.body !== undefined ? { body: preferences.body } : {}),
    ...(preferences.sweetness !== undefined ? { sweetness: preferences.sweetness } : {}),
    ...(preferences.freshness !== undefined ? { freshness: preferences.freshness } : {}),
    ...(preferences.roastDepth !== undefined ? { roastDepth: preferences.roastDepth } : {}),
    ...(preferences.aroma ? { aroma: [...preferences.aroma] } : {}),
    ...(preferences.context !== undefined ? { context: preferences.context } : {}),
    ...(preferences.familiarity !== undefined ? { familiarity: preferences.familiarity } : {}),
    ...(preferences.discoveryTolerance !== undefined ? { discoveryTolerance: preferences.discoveryTolerance } : {}),
  };
}
