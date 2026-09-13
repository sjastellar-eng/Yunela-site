export type TeaFeedbackValue = 'Loved it' | 'Liked it' | 'Not for me';
export type RecommendationOutcome =
  | 'purchased'
  | 'feedback_received'
  | 'second_purchase'
  | 'unknown';

/** MVP taste preferences mirror the approved Finder profile dimensions without adding new product logic. */
export interface TastePreferences {
  body?: number;
  sweetness?: number;
  freshness?: number;
  roastDepth?: number;
  aroma?: string[];
  context?: string;
  familiarity?: string;
  discoveryTolerance?: string;
}

export interface Customer {
  id: string;
  email: string;
  createdAt: string;
}

export interface TeaProfile {
  customerId: string;
  purchasedTeaIds: string[];
  likedTeaIds: string[];
  dislikedTeaIds: string[];
  tastePreferences: TastePreferences;
  feedbackIds: string[];
  recommendationIds: string[];
  updatedAt: string;
}

export interface Feedback {
  id: string;
  customerId: string;
  teaId: string;
  value: TeaFeedbackValue;
  sensoryTags: string[];
  createdAt: string;
}

export interface RecommendationHistoryEntry {
  id: string;
  customerId: string;
  teaId: string;
  algorithmVersion: string;
  score: number;
  classification: 'MATCH' | 'STRETCH' | 'WILDCARD';
  explanation: string[];
  createdAt: string;
  outcome?: RecommendationOutcome;
}
