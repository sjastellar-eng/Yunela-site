import { randomUUID } from 'node:crypto';
import type { DiscoveryBox } from '../../contracts/discoveryBox';
import { DISCOVERY_BOX_SELECTION_VERSION } from '../../contracts/discoveryBox';
import type { RecommendationRequest } from '../../contracts/recommendation';
import { ApplicationError } from '../errors';
import type { DiscoveryBoxRepository } from '../repositories';
import type { RecommendationApplicationService } from '../recommendation/service';
import { selectDiscoveryBoxItems } from '../../domain/discoveryBox/selectionPolicy';

export interface DiscoveryBoxApplicationDependencies {
  recommendationService: RecommendationApplicationService;
  boxRepository: DiscoveryBoxRepository;
  clock?: () => string;
}

export class DiscoveryBoxApplicationService {
  private readonly clock: () => string;

  constructor(private readonly dependencies: DiscoveryBoxApplicationDependencies) {
    this.clock = dependencies.clock ?? (() => new Date().toISOString());
  }

  async createBox(request: RecommendationRequest): Promise<DiscoveryBox> {
    const recommendations = await this.dependencies.recommendationService.recommend(request);
    const items = selectDiscoveryBoxItems(recommendations);
    const algorithmVersions = new Set(recommendations.map((result) => result.algorithmVersion));
    if (algorithmVersions.size !== 1) {
      throw new ApplicationError('DOMAIN_RULE_VIOLATION', 'Discovery Box requires one C3 algorithm version');
    }

    const box: DiscoveryBox = {
      id: `discovery-box:${randomUUID()}`,
      ...(request.customerId ? { customerId: request.customerId } : {}),
      algorithmVersion: recommendations[0]?.algorithmVersion ?? 'recommendation-v1',
      selectionVersion: DISCOVERY_BOX_SELECTION_VERSION,
      profileReference: request.profileReference,
      items,
      createdAt: this.clock(),
    };

    this.dependencies.boxRepository.create(box);
    return box;
  }

  getBox(id: string): DiscoveryBox {
    const box = this.dependencies.boxRepository.getById(id);
    if (!box) throw new ApplicationError('NOT_FOUND', `Discovery Box ${id} was not found`);
    return box;
  }
}
