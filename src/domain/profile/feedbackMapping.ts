import type { Feedback, TastePreferences } from '../../contracts/account';

export const CANONICAL_SENSORY_TAG_MAP = {
  floral: { dimension: 'aroma', value: 'floral' },
  fruity: { dimension: 'aroma', value: 'fruity' },
  mineral: { dimension: 'aroma', value: 'mineral' },
  earthy: { dimension: 'aroma', value: 'earthy' },
  woody: { dimension: 'aroma', value: 'woody' },
  creamy: { dimension: 'aroma', value: 'creamy' },
  fresh: { dimension: 'freshness' },
  sweet: { dimension: 'sweetness' },
  roasted: { dimension: 'roastDepth' },
  deep: { dimension: 'roastDepth' },
} as const;

const NUMERIC_DIMENSIONS = ['sweetness', 'freshness', 'roastDepth'] as const;
type NumericDimension = (typeof NUMERIC_DIMENSIONS)[number];

const FEEDBACK_SIGNAL = {
  'Loved it': 10,
  'Liked it': 5,
  'Not for me': -10,
} as const;

const INITIAL_NUMERIC_PREFERENCE = 50;
const MIN_PREFERENCE = 0;
const MAX_PREFERENCE = 100;

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase();
}

function clamp(value: number): number {
  return Math.max(MIN_PREFERENCE, Math.min(MAX_PREFERENCE, value));
}

function applyNumericSignals(
  preferences: TastePreferences,
  feedback: Feedback,
  normalizedTags: string[],
): void {
  const signal = FEEDBACK_SIGNAL[feedback.value];
  const signalsByDimension = new Map<NumericDimension, number[]>();

  for (const tag of normalizedTags) {
    const mapping = CANONICAL_SENSORY_TAG_MAP[tag as keyof typeof CANONICAL_SENSORY_TAG_MAP];
    if (!mapping || mapping.dimension === 'aroma') continue;
    const dimension = mapping.dimension as NumericDimension;
    const signals = signalsByDimension.get(dimension) ?? [];
    signals.push(signal);
    signalsByDimension.set(dimension, signals);
  }

  for (const [dimension, signals] of signalsByDimension) {
    const current = preferences[dimension] ?? INITIAL_NUMERIC_PREFERENCE;
    const averagedSignal = signals.reduce((sum, value) => sum + value, 0) / signals.length;
    preferences[dimension] = clamp(current + averagedSignal);
  }
}

function applyAromaSignals(
  preferences: TastePreferences,
  feedback: Feedback,
  normalizedTags: string[],
): void {
  const current = new Set((preferences.aroma ?? []).map(normalizeTag).filter(Boolean));
  const isPositive = feedback.value === 'Loved it' || feedback.value === 'Liked it';

  for (const tag of normalizedTags) {
    const mapping = CANONICAL_SENSORY_TAG_MAP[tag as keyof typeof CANONICAL_SENSORY_TAG_MAP];
    if (!mapping || mapping.dimension !== 'aroma') continue;
    if (isPositive) current.add(mapping.value);
    else current.delete(mapping.value);
  }

  preferences.aroma = [...current].sort();
}

/**
 * Applies exactly one stored feedback event to derived TastePreferences.
 * Unknown tags are deliberately ignored; no synonym or semantic expansion occurs.
 */
export function applyFeedbackToTastePreferences(
  preferences: TastePreferences,
  feedback: Feedback,
): TastePreferences {
  const next: TastePreferences = {
    ...preferences,
    ...(preferences.aroma ? { aroma: [...preferences.aroma] } : {}),
  };
  const normalizedTags = feedback.sensoryTags.map(normalizeTag);

  applyNumericSignals(next, feedback, normalizedTags);
  applyAromaSignals(next, feedback, normalizedTags);

  return next;
}

/**
 * Rebuilds the derived taste state from the complete ordered feedback history.
 * Ordering is createdAt ascending, then id ascending for deterministic replay.
 */
export function rebuildTastePreferences(feedbackHistory: Feedback[]): TastePreferences {
  const preferences: TastePreferences = {};
  const ordered = [...feedbackHistory].sort((a, b) => {
    const createdAtOrder = a.createdAt.localeCompare(b.createdAt);
    return createdAtOrder !== 0 ? createdAtOrder : a.id.localeCompare(b.id);
  });

  for (const feedback of ordered) {
    applyFeedbackToTastePreferences(preferences, feedback);
  }

  return preferences;
}
