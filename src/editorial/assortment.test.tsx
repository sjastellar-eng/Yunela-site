import {describe,it,expect} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {PreparingTeaware,PreparingGifts} from './Editorial';
import {teawareCategories,giftDirections} from './structure';
import {accessoryOverviews} from './categoryOverviews';
describe('category overviews stay separate from sale items',()=>{
 it('gives every published direction original category art without prices, purchase or availability claims',()=>{
  for(const [page,directions] of [[<PreparingTeaware/>,teawareCategories.map(c=>c.title)],[<PreparingGifts/>,giftDirections.map(c=>c[0])]] as const){
   const html=renderToStaticMarkup(page);
   for(const title of directions)expect(html).toContain(title);
   expect(html.match(/Ілюстрація категорії/g)?.length).toBe(directions.length);
   for(const text of ['До кошика','Купити','Під замовлення','У наявності','₴','грн','sourceUrl','purchasePrice'])expect(html).not.toContain(text);
   expect(html).toContain('Готуємо колекцію');
  }
 });
 it('keeps all ten accessory explanations and the engraving concept nontransactional',()=>{
  const html=renderToStaticMarkup(<PreparingTeaware/>);
  expect(accessoryOverviews).toHaveLength(10);
  for(const a of accessoryOverviews){expect(html).toContain(a.title);expect(html).toContain(a.description);}
  expect(html).toContain('Чабані з індивідуальним гравіюванням');
  expect(html).toContain('Візуалізація концепції. Замовлення ще не приймаємо.');
  expect(html).not.toContain('<form');expect(html).not.toContain('<input');
 });
 it('prepares an empty private procurement draft rather than fabricating a sellable record',()=>{
  const draft=JSON.parse(readFileSync('docs/sourcing/PRODUCT_DRAFT_TEMPLATE.json','utf8'));
  expect(draft.publicationStatus).toBe('DRAFT_INTERNAL');
  expect(draft.purchaseSource.sourceUrl).toBeNull();expect(draft.purchasePrice.amount).toBeNull();
  expect(draft.availability.status).toBe('UNVERIFIED');expect(draft.photoRights.status).toBe('UNVERIFIED');
 });
});
