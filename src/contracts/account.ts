export type TeaFeedbackValue = 'Loved it' | 'Liked it' | 'Not for me';

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
  tastePreferences: Record<string, unknown>;
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
  outcome?: string;
}
