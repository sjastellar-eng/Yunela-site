import type { RecommendationRequest, RecommendationResult, RecommendationService } from '../../contracts/recommendation';
import { ApplicationError } from '../errors';
import { validateRecommendationRequest, validateRecommendationResult } from '../validation';

export interface RecommendationEngine {
  recommend(request: RecommendationRequest): Promise<RecommendationResult[]>;
}

export class NotConfiguredRecommendationEngine implements RecommendationEngine {
  async recommend(_request: RecommendationRequest): Promise<RecommendationResult[]> {
    throw new ApplicationError('NOT_IMPLEMENTED', 'Recommendation algorithm is intentionally deferred to Stage C3');
  }
}

export class RecommendationApplicationService implements RecommendationService {
  constructor(private readonly engine: RecommendationEngine) {}

  async recommend(request: RecommendationRequest): Promise<RecommendationResult[]> {
    validateRecommendationRequest(request);
    const results = await this.engine.recommend(request);
    for (const result of results) validateRecommendationResult(result);
    return results;
  }
}
