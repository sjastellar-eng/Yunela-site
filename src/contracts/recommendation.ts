import type { Tea } from './tea';

export type RecommendationClassification = 'MATCH' | 'STRETCH' | 'WILDCARD';

export interface RecommendationWeights {
  tasteFit: 0.5;
  body: 0.15;
  roastDepth: 0.1;
  familiarityAccessibility: 0.1;
  context: 0.05;
  discoveryTolerance: 0.1;
}

export interface FinderProfileReference {
  body?: number;
  sweetness?: number;
  freshness?: number;
  roastDepth?: number;
  aroma?: string[];
  context?: string;
  familiarity?: string;
  discoveryTolerance?: string;
}

export interface RecommendationRequest {
  profileReference: FinderProfileReference;
  candidateTeaIds?: string[];
  algorithmVersion: string;
}

export interface RecommendationResult {
  tea: Pick<Tea, 'id' | 'slug' | 'name'>;
  classification: RecommendationClassification;
  score: number;
  reasons: string[];
  context?: string;
  algorithmVersion: string;
  profileReference: FinderProfileReference;
  createdAt: string;
  outcome?: 'purchased' | 'feedback_received' | 'second_purchase' | 'unknown';
}

export interface RecommendationService {
  recommend(request: RecommendationRequest): Promise<RecommendationResult[]>;
}

export const RECOMMENDATION_WEIGHTS: RecommendationWeights = {
  tasteFit: 0.5,
  body: 0.15,
  roastDepth: 0.1,
  familiarityAccessibility: 0.1,
  context: 0.05,
  discoveryTolerance: 0.1,
};

export function classifyRecommendation(score: number): RecommendationClassification | null {
  if (score >= 80) return 'MATCH';
  if (score >= 65) return 'STRETCH';
  if (score >= 50) return 'WILDCARD';
  return null;
}
