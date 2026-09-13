import type { Feedback, Customer, RecommendationHistoryEntry, TeaProfile } from '../contracts/account';
import type { Tea } from '../contracts/tea';

export interface TeaTaxonomyReference {
  familyId: string;
  subfamilyId?: string;
  styleId?: string;
}

export interface TeaRepository {
  create(tea: Tea, taxonomy: TeaTaxonomyReference): void;
  getById(id: string): Tea | undefined;
  list(): Tea[];
  update(tea: Tea, taxonomy: TeaTaxonomyReference): Tea | undefined;
}

export interface CustomerRepository {
  create(customer: Customer): void;
  getById(id: string): Customer | undefined;
  update(customer: Customer): Customer | undefined;
}

export interface TeaProfileRepository {
  getByCustomerId(customerId: string): TeaProfile | undefined;
  upsert(profile: TeaProfile): void;
}

export interface FeedbackRepository {
  create(feedback: Feedback): void;
  listByCustomerId(customerId: string): Feedback[];
  listByTeaId(teaId: string): Feedback[];
}

export interface RecommendationHistoryRepository {
  create(entry: RecommendationHistoryEntry): void;
}
