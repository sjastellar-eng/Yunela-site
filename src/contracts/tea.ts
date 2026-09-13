export type PublishingState = 'draft' | 'pending_qa' | 'published' | 'archived';
export type SupplyStatus = 'unknown' | 'available' | 'limited' | 'unavailable' | 'discontinued';
export type ProvenanceConfidence = 'unknown' | 'low' | 'medium' | 'high' | 'verified';

export interface SensoryProfile {
  aroma: string[];
  sweetness: number;
  body: number;
  freshness: number;
  roast: number;
  depth: number;
  astringency: number;
  finish: number;
  floral: number;
  fruity: number;
  mineral: number;
  earthyWoody: number;
}

export interface Tea {
  id: string;
  slug: string;
  name: string;
  chineseName?: string;
  transliteration?: string;
  family: string;
  subfamily?: string;
  style?: string;
  province?: string;
  area?: string;
  region?: string;
  cultivar?: string;
  harvestSeason?: string;
  harvestYear?: number;
  processing?: string;
  oxidationFermentation?: string;
  productionDate?: string;
  batchLot?: string;
  sensory: SensoryProfile;
  discoveryDistance: number;
  price: number;
  currency: string;
  packSize: number;
  inventory: number;
  supplyStatus: SupplyStatus;
  provenanceConfidence: ProvenanceConfidence;
  supplierReference?: string;
  lotTraceability?: string;
  publishingState: PublishingState;
}

/** Discovery placeholders must never be presented as production tea facts. */
export interface TeaSeedRecord extends Partial<Tea> {
  id: string;
  name: string;
  isDiscoveryPlaceholder: true;
}
