import prices from '../data/catalog-price-preview.json';

type Offer = { grams: number | null; retailUah: number | null };
const offers: Partial<Record<string, Offer>> = prices;
const currency = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function previewOffer(sku: string) {
  return offers[sku];
}

export function isPressedTea(sku: string) {
  return sku.startsWith('PHOTO-') || sku === 'LIST-012';
}

export function weightPrice(sku: string, retailUah: number, packageGrams: number, grams: number) {
  if (isPressedTea(sku)) {
    const wholeCakes = Math.floor(grams / packageGrams);
    const remainder = grams % packageGrams;
    // 100 g is the first cut, then each halving adds another 20%.
    const cuts = remainder === 25 ? 3 : remainder === 50 ? 2 : 1;
    const portion = Math.ceil(retailUah * remainder * 6 ** cuts / (packageGrams * 5 ** cuts * 10)) * 10;
    return currency.format(wholeCakes * retailUah + portion);
  }


  const pricePer100Grams = Math.ceil((retailUah * 100 - 9 * packageGrams) / (10 * packageGrams)) * 10 + 9;
  return currency.format(Math.ceil(pricePer100Grams * grams / 100));
}

export function previewPrice(sku: string): string | null {
  const offer = previewOffer(sku);
  if (!offer || offer.retailUah === null) return null;

  return offer.grams === null
    ? `${currency.format(offer.retailUah)} · цілий млинець`
    : `${weightPrice(sku, offer.retailUah, offer.grams, 100)} / 100 г`;
}
