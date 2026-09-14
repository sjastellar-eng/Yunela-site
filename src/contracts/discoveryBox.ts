import type { FinderProfileReference } from './recommendation';
import type { RecommendationClassification } from './recommendation';

export const DISCOVERY_BOX_SELECTION_VERSION = 'discovery-box-v1';

export interface DiscoveryBoxItem {
  teaId: string;
  classification: RecommendationClassification;
  position: number;
  score: number;
  reasons: string[];
}

export interface DiscoveryBox {
  id: string;
  customerId?: string;
  algorithmVersion: string;
  selectionVersion: typeof DISCOVERY_BOX_SELECTION_VERSION;
  profileReference: FinderProfileReference;
  items: DiscoveryBoxItem[];
  createdAt: string;
}
