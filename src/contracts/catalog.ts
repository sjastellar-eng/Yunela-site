import type { Money } from './commerce';

export type CommercialProductKind = 'TEA' | 'DISCOVERY_BOX';

export interface CommercialProduct {
  sku: string;
  kind: CommercialProductKind;
  name: string;
  price: Money;
  teaId?: string;
  discoveryBoxId?: string;
  available: boolean;
}

/** Catalog owns SKU definition and price; Commerce only consumes this boundary. */
export interface CommercialProductRepository {
  getBySku(sku: string): CommercialProduct | undefined;
}
