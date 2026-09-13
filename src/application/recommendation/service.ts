import type { RecommendationRequest, RecommendationResult, RecommendationService } from '../../contracts/recommendation';
import { ApplicationError } from '../errors';
import type { CustomerRepository, RecommendationHistoryRepository, TeaRepository } from '../repositories';
import { validateRecommendationRequest, validateRecommendationResult } from '../validation';
import { recommendTeas, RECOMMENDATION_ALGORITHM_VERSION } from '../../domain/recommendation/engine';

export interface RecommendationEngine {
  recommend(request: RecommendationRequest): Promise<RecommendationResult[]>;
}

export class DeterministicRecommendationEngine implements RecommendationEngine {
  constructor(private readonly teaRepository: TeaRepository) {}

  async recommend(request: RecommendationRequest): Promise<RecommendationResult[]> {
    const candidates = request.candidateTeaIds?.length
      ? request.candidateTeaIds
        .map((id) => this.teaRepository.getById(id))
        .filter((tea): tea is NonNullable<typeof tea> => tea !== undefined)
      : this.teaRepository.list();
    return recommendTeas(request.profileReference, candidates);
  }
}

export class NotConfiguredRecommendationEngine implements RecommendationEngine {
  async recommend(): Promise<RecommendationResult[]> {
    throw new ApplicationError('NOT_IMPLEMENTED', 'Recommendation algorithm is intentionally deferred to Stage C3');
  }
}

export interface RecommendationApplicationDependencies {
  teaRepository: TeaRepository;
  customerRepository: CustomerRepository;
  historyRepository: RecommendationHistoryRepository;
}

export class RecommendationApplicationService implements RecommendationService {
  private readonly dependencies?: RecommendationApplicationDependencies;
  private readonly clock: () => string;

  constructor(
    private readonly engine: RecommendationEngine,
    dependencies?: RecommendationApplicationDependencies,
    clock: () => string = () => new Date().toISOString(),
  ) {
    this.dependencies = dependencies;
    this.clock = clock;
  }

  async recommend(request: RecommendationRequest): Promise<RecommendationResult[]> {
    validateRecommendationRequest(request);
    if (request.customerId && this.dependencies && !this.dependencies.customerRepository.getById(request.customerId)) {
      throw new ApplicationError('NOT_FOUND', `Customer ${request.customerId} was not found`);
    }

    const results = await this.engine.recommend(request);
    const createdAt = this.clock();
    const stamped = results.map((result, index) => ({ ...result, createdAt, algorithmVersion: RECOMMENDATION_ALGORITHM_VERSION }));

    for (const result of stamped) validateRecommendationResult(result);

    if (request.customerId && this.dependencies) {
      for (const [index, result] of stamped.entries()) {
        this.dependencies.historyRepository.create({
          id: `recommendation:${request.customerId}:${createdAt}:${index}`,
          customerId: request.customerId,
          teaId: result.tea.id,
          algorithmVersion: result.algorithmVersion,
          score: result.score,
          classification: result.classification,
          explanation: result.reasons,
          createdAt: result.createdAt,
          outcome: result.outcome,
        });
      }
    }

    return stamped;
  }
}
