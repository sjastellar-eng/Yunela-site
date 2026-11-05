import prices from '../data/catalog-price-preview.json';

type Offer = { grams: number | null; retailUah: number | null };
const offers: Partial<Record<string, Offer>> = prices;
const currency = new Intl.NumberFormat('uk-UA', {
  style: 'currency',
  currency: 'UAH',
  maximumFractionDigits: 0,
});

export function previewPrice(sku: string): string | null {
  const offer = offers[sku];
  if (!offer) return null;

  const quantity = offer.grams === null ? 'цілий млинець' : `${offer.grams} г`;
  const price = offer.retailUah === null ? 'Ціну уточнюємо' : currency.format(offer.retailUah);
  return `${price} · ${quantity}`;
}
