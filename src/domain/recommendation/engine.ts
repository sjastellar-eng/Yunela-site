import type { FinderProfileReference, RecommendationClassification, RecommendationResult } from '../../contracts/recommendation';
import type { Tea } from '../../contracts/tea';

export const RECOMMENDATION_ALGORITHM_VERSION = 'recommendation-v1';

export interface RecommendationComponentScores {
  tasteFit: number | null;
  body: number | null;
  roastDepth: number | null;
  familiarityAccessibility: number | null;
  context: number | null;
  discoveryTolerance: number | null;
}

const WEIGHTS = {
  tasteFit: 0.5,
  body: 0.15,
  roastDepth: 0.1,
  familiarityAccessibility: 0.1,
  context: 0.05,
  discoveryTolerance: 0.1,
} as const;

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function numericMatch(preference: number | undefined, actual: number | undefined): number | null {
  if (preference === undefined || actual === undefined || !Number.isFinite(preference) || !Number.isFinite(actual)) return null;
  return clamp(100 - Math.abs(preference - actual));
}

function aromaMatch(profile: string[] | undefined, tea: string[]): number | null {
  if (!profile || profile.length === 0 || tea.length === 0) return null;
  const wanted = new Set(profile.map((item) => item.trim().toLowerCase()).filter(Boolean));
  const actual = new Set(tea.map((item) => item.trim().toLowerCase()).filter(Boolean));
  if (wanted.size === 0 || actual.size === 0) return null;
  let overlap = 0;
  for (const item of wanted) if (actual.has(item)) overlap += 1;
  return (overlap / wanted.size) * 100;
}

function tasteFit(profile: FinderProfileReference, tea: Tea): number | null {
  const parts = [
    numericMatch(profile.sweetness, tea.sensory.sweetness),
    numericMatch(profile.freshness, tea.sensory.freshness),
    aromaMatch(profile.aroma, tea.sensory.aroma),
  ].filter((value): value is number => value !== null);
  return parts.length ? parts.reduce((sum, value) => sum + value, 0) / parts.length : null;
}

function familiarityCeiling(value: string | undefined): number | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (['beginner', 'new', 'newcomer', 'low'].includes(normalized)) return 35;
  if (['familiar', 'intermediate', 'medium'].includes(normalized)) return 65;
  if (['experienced', 'expert', 'advanced', 'high'].includes(normalized)) return 100;
  return null;
}

function discoveryCeiling(value: string | undefined): number | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return null;
  if (['conservative', 'safe', 'low', 'little'].includes(normalized)) return 30;
  if (['open', 'moderate', 'medium'].includes(normalized)) return 65;
  if (['adventurous', 'exploratory', 'high', 'very high'].includes(normalized)) return 100;
  return null;
}

function ceilingScore(distance: number, ceiling: number): number {
  if (distance <= ceiling) return 100;
  if (ceiling >= 100) return 100;
  return clamp(100 - ((distance - ceiling) / (100 - ceiling)) * 100);
}

export function calculateTasteFit(profile: FinderProfileReference, tea: Tea): number | null {
  return tasteFit(profile, tea);
}

export function calculateBodyScore(profile: FinderProfileReference, tea: Tea): number | null {
  return numericMatch(profile.body, tea.sensory.body);
}

export function calculateRoastDepthScore(profile: FinderProfileReference, tea: Tea): number | null {
  if (profile.roastDepth === undefined) return null;
  const roastDepth = (tea.sensory.roast + tea.sensory.depth) / 2;
  return numericMatch(profile.roastDepth, roastDepth);
}

export function calculateFamiliarityScore(profile: FinderProfileReference, tea: Tea): number | null {
  const ceiling = familiarityCeiling(profile.familiarity);
  return ceiling === null ? null : ceilingScore(tea.discoveryDistance, ceiling);
}

export function calculateContextScore(_profile: FinderProfileReference, _tea: Tea): number | null {
  // Tea currently has no structured context/role attribute. Missing data is explicit, not neutral.
  return null;
}

export function calculateDiscoveryScore(profile: FinderProfileReference, tea: Tea): number | null {
  const ceiling = discoveryCeiling(profile.discoveryTolerance);
  return ceiling === null ? null : ceilingScore(tea.discoveryDistance, ceiling);
}

export function calculateComponentScores(profile: FinderProfileReference, tea: Tea): RecommendationComponentScores {
  return {
    tasteFit: calculateTasteFit(profile, tea),
    body: calculateBodyScore(profile, tea),
    roastDepth: calculateRoastDepthScore(profile, tea),
    familiarityAccessibility: calculateFamiliarityScore(profile, tea),
    context: calculateContextScore(profile, tea),
    discoveryTolerance: calculateDiscoveryScore(profile, tea),
  };
}

export function calculateRecommendationScore(scores: RecommendationComponentScores): number | null {
  const entries = (Object.keys(WEIGHTS) as Array<keyof typeof WEIGHTS>)
    .map((key) => ({ weight: WEIGHTS[key], score: scores[key] }))
    .filter((entry): entry is { weight: number; score: number } => entry.score !== null);
  if (entries.length === 0) return null;
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  return clamp(entries.reduce((sum, entry) => sum + entry.score * entry.weight, 0) / totalWeight);
}

export function classifyRecommendationBand(score: number): RecommendationClassification | null {
  if (score >= 80) return 'MATCH';
  if (score >= 65) return 'STRETCH';
  if (score >= 50) return 'WILDCARD';
  return null;
}

function reasonForScore(label: string, score: number | null): string | null {
  if (score === null) return null;
  if (score >= 80) return `Matches your preference for ${label}`;
  if (score >= 65) return `Close to your preference for ${label}`;
  return `A controlled discovery step for ${label}`;
}

export function buildRecommendationReasons(scores: RecommendationComponentScores): string[] {
  const reasons = [
    reasonForScore('taste', scores.tasteFit),
    reasonForScore('body', scores.body),
    reasonForScore('fresh/roasted balance', scores.roastDepth),
    reasonForScore('familiarity', scores.familiarityAccessibility),
    reasonForScore('exploration level', scores.discoveryTolerance),
  ].filter((reason): reason is string => reason !== null);
  return reasons.slice(0, 3);
}

export function isEligibleTea(tea: Tea): boolean {
  return tea.publishingState === 'published'
    && tea.inventory > 0
    && tea.supplyStatus !== 'unavailable'
    && tea.supplyStatus !== 'discontinued';
}

export function scoreTea(profile: FinderProfileReference, tea: Tea): RecommendationResult | null {
  const scores = calculateComponentScores(profile, tea);
  const score = calculateRecommendationScore(scores);
  if (score === null) return null;
  const classification = classifyRecommendationBand(score);
  if (classification === null) return null;
  return {
    tea: { id: tea.id, slug: tea.slug, name: tea.name },
    classification,
    score,
    reasons: buildRecommendationReasons(scores),
    algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION,
    profileReference: profile,
    createdAt: '',
  };
}

export function recommendTeas(profile: FinderProfileReference, teas: Tea[]): RecommendationResult[] {
  return teas
    .filter(isEligibleTea)
    .map((tea) => scoreTea(profile, tea))
    .filter((result): result is RecommendationResult => result !== null)
    .sort((a, b) => b.score - a.score || a.tea.id.localeCompare(b.tea.id));
}
