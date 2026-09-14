import type { Feedback, TastePreferences } from '../../contracts/account';
import type { FinderProfileReference } from '../../contracts/recommendation';

type CanonicalMapping =
  | { dimension: 'aroma'; value: string }
  | { dimension: 'freshness' }
  | { dimension: 'sweetness' }
  | { dimension: 'roastDepth' };

export const CANONICAL_SENSORY_TAG_MAP: Record<string, CanonicalMapping> = {
  floral: { dimension: 'aroma', value: 'floral' }, fruity: { dimension: 'aroma', value: 'fruity' },
  mineral: { dimension: 'aroma', value: 'mineral' }, earthy: { dimension: 'aroma', value: 'earthy' },
  woody: { dimension: 'aroma', value: 'woody' }, creamy: { dimension: 'aroma', value: 'creamy' },
  fresh: { dimension: 'freshness' }, sweet: { dimension: 'sweetness' },
  roasted: { dimension: 'roastDepth' }, deep: { dimension: 'roastDepth' },
};

type NumericDimension = 'sweetness' | 'freshness' | 'roastDepth';
const FEEDBACK_SIGNAL: Record<Feedback['value'], number> = { 'Loved it': 10, 'Liked it': 5, 'Not for me': -10 };
const INITIAL_NUMERIC_PREFERENCE = 50;
const MIN_PREFERENCE = 0;
const MAX_PREFERENCE = 100;

function normalizeTag(tag: string): string { return tag.trim().toLowerCase(); }
function clamp(value: number): number { return Math.max(MIN_PREFERENCE, Math.min(MAX_PREFERENCE, value)); }

function getCanonicalMapping(tag: string): CanonicalMapping | undefined {
  switch (tag) {
    case 'floral': return { dimension: 'aroma', value: 'floral' };
    case 'fruity': return { dimension: 'aroma', value: 'fruity' };
    case 'mineral': return { dimension: 'aroma', value: 'mineral' };
    case 'earthy': return { dimension: 'aroma', value: 'earthy' };
    case 'woody': return { dimension: 'aroma', value: 'woody' };
    case 'creamy': return { dimension: 'aroma', value: 'creamy' };
    case 'fresh': return { dimension: 'freshness' };
    case 'sweet': return { dimension: 'sweetness' };
    case 'roasted': return { dimension: 'roastDepth' };
    case 'deep': return { dimension: 'roastDepth' };
    default: return undefined;
  }
}

function applyNumericSignals(preferences: TastePreferences, feedback: Feedback, normalizedTags: string[]): void {
  const signal = FEEDBACK_SIGNAL[feedback.value];
  const signalsByDimension = new Map<NumericDimension, number[]>();
  for (const tag of normalizedTags) {
    const mapping = getCanonicalMapping(tag);
    if (!mapping || mapping.dimension === 'aroma') continue;
    const signals = signalsByDimension.get(mapping.dimension) ?? [];
    signals.push(signal);
    signalsByDimension.set(mapping.dimension, signals);
  }
  for (const [dimension, signals] of signalsByDimension) {
    const current = preferences[dimension] ?? INITIAL_NUMERIC_PREFERENCE;
    const averagedSignal = signals.reduce((sum, value) => sum + value, 0) / signals.length;
    preferences[dimension] = clamp(current + averagedSignal);
  }
}

function applyAromaSignals(preferences: TastePreferences, feedback: Feedback, normalizedTags: string[]): void {
  const mappedAromaValues: string[] = [];
  for (const tag of normalizedTags) {
    const mapping = getCanonicalMapping(tag);
    if (mapping?.dimension === 'aroma') mappedAromaValues.push(mapping.value);
  }
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
