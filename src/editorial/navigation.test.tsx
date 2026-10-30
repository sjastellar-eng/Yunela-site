import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import {matchesTeaCategory,parseEditorialRoute,firstTeaSkus,relatedTeaReason} from './catalogNavigation';
import {PreparingTeaware,PreparingGifts,JournalArticle} from './Editorial';
import {articles} from './journalData';
import type {DiscoveryProduct} from '../yuna/discovery';
const items=JSON.parse(readFileSync('public/demo-catalog.json','utf8')).items as DiscoveryProduct[];
const find=(sku:string)=>items.find(p=>p.sku===sku)!;
describe('evidence-bound navigation',()=>{
 it('separates shu and shen from observed source labels, not photos or marketing prose',()=>{expect(matchesTeaCategory(find('PHOTO-010'),'SHU')).toBe(true);expect(matchesTeaCategory(find('PHOTO-017'),'SHEN')).toBe(true);for(const sku of ['PHOTO-002','PHOTO-008','PHOTO-011','PHOTO-024','PHOTO-014']){expect(matchesTeaCategory(find(sku),'SHU')).toBe(false);expect(matchesTeaCategory(find(sku),'SHEN')).toBe(false);}expect(matchesTeaCategory(find('PHOTO-017'),'SHU')).toBe(false);});
 it('fails closed if observed type evidence is removed',()=>{const p=structuredClone(find('PHOTO-010'));p.contentV2!.evidence.category.status='UNKNOWN';expect(matchesTeaCategory(p,'SHU')).toBe(false);});
 it('does not invent dark/GABA oolong or infer light oolong from a possible name',()=>{expect(items.filter(p=>matchesTeaCategory(p,'LIGHT_OOLONG')).map(p=>p.sku)).toEqual(['LIST-022']);expect(matchesTeaCategory(find('LIST-013'),'LIGHT_OOLONG')).toBe(false);expect(matchesTeaCategory(find('LIST-023'),'GABA_OOLONG')).toBe(false);});
 it('keeps selection identity and recommendations tied to existing declared categories',()=>{expect(firstTeaSkus.every(s=>!!find(s))).toBe(true);expect(relatedTeaReason(find('PHOTO-008'),find('PHOTO-011'))).toBeNull();expect(relatedTeaReason(find('PHOTO-010'),find('PHOTO-010'))).toBeNull();expect(relatedTeaReason(find('PHOTO-010'),find('PHOTO-012'))).toContain('партії ще уточнюємо');});
 it('round trips article and UTF8 category links, handles invalid URI without throwing',()=>{expect(parseEditorialRoute('#/journal/gongfu').page).toBe('article:gongfu');expect(parseEditorialRoute('#/tea/'+encodeURIComponent('Улуни')).category).toBe('Улуни');expect(parseEditorialRoute('#/tea/SHU').category).toBe('SHU');expect(parseEditorialRoute('#/tea/unknown').category).toBe('ALL');expect(parseEditorialRoute('#/journal/%ZZ').page).toBe('not-found');expect(parseEditorialRoute('#/collection/first').collection).toBe('first');});
});
describe('honest editorial pages',()=>{
 it('has three independent articles with deep links, useful sections and source IDs',()=>{expect(articles).toHaveLength(3);for(const a of articles){expect(a.sections.length).toBeGreaterThanOrEqual(4);expect(a.sourceIds.length).toBeGreaterThan(0);expect(renderToStaticMarkup(<JournalArticle slug={a.slug}/>)).toContain(a.title);}});
 it('never markets imaginary teaware or gift inventory',()=>{for(const html of [renderToStaticMarkup(<PreparingTeaware/>),renderToStaticMarkup(<PreparingGifts/>)]){expect(html).toContain('Готуємо колекцію');expect(html).not.toContain('До кошика');expect(html).not.toContain('₴');expect(html).not.toContain('грн');}});
});

describe('Task19 article reading paths',()=>{
 it('links each article to two existing source records, two other stories and one original practical paragraph',()=>{
  for(const a of articles){
   const html=renderToStaticMarkup(<JournalArticle slug={a.slug} products={items} onOpen={()=>{}}/>);
   expect(html).toContain('СПРОБУЙ НА ПРАКТИЦІ');
   expect(html.match(/class="article-tip"/g)).toHaveLength(1);
   for(const other of articles.filter(x=>x.slug!==a.slug))expect(html).toContain(`href="#/journal/${other.slug}"`);
   expect(html).toContain('Чаї до теми статті');
   expect(html).not.toContain('До кошика');
   expect(html).not.toContain('₴');
  }
 });
});
