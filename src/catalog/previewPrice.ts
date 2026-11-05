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

export function weightPrice(retailUah: number, packageGrams: number, grams: number) {
  const pricePer100Grams = Math.ceil((retailUah * 100 - 9 * packageGrams) / (10 * packageGrams)) * 10 + 9;
  return currency.format(Math.ceil(pricePer100Grams * grams / 100));
}

export function previewPrice(sku: string): string | null {
  const offer = previewOffer(sku);
  if (!offer || offer.retailUah === null) return null;

  return offer.grams === null
    ? `${currency.format(offer.retailUah)} · цілий млинець`
    : `${weightPrice(offer.retailUah, offer.grams, 100)} / 100 г`;
}
