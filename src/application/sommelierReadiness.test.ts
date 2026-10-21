import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {assessSommelierReadiness} from './sommelierReadiness';
const catalogue=JSON.parse(readFileSync('public/demo-catalog.json','utf8'));
describe('V2 content safety',()=>{
 it('preserves 56 unique source identities and nine unresolved groups',()=>{expect(catalogue.items).toHaveLength(56);expect(new Set(catalogue.items.map((p:{sku:string})=>p.sku)).size).toBe(56);expect(catalogue.duplicateReview.groups).toHaveLength(9);});
 it('blocks commerce and recommendation for every unverified record',()=>{for(const p of catalogue.items){expect(p.price).toBeNull();expect(p.stock).toBeNull();expect(p.confirmed).toBe(false);expect(p.commercial).toBeNull();expect(p.contentV2.salesAllowed).toBe(false);expect(assessSommelierReadiness(p.contentV2).eligible).toBe(false);expect(Object.values(p.contentV2.sensory).every(x=>x===null)).toBe(true);}});
 it('keeps corrected taxonomy and distinct similar names',()=>{expect(catalogue.items.find((p:{sku:string})=>p.sku==='PHOTO-014').contentV2.category).toBe('Червоний чай');for(const sku of ['LIST-014','LIST-015','LIST-017'])expect(catalogue.items.some((p:{sku:string})=>p.sku===sku)).toBe(true);});
 it('does not allow approval or numeric defaults to replace lot evidence',()=>{const p=structuredClone(catalogue.items[0].contentV2);p.recommendationApproved=true;p.canonicalStatus='CONFIRMED';p.verifiedFields=['aroma','sweetness','freshness','body','roast','depth','discoveryDistance'];p.sensory={aroma:['floral'],sweetness:50,freshness:50,body:50,roast:50,depth:50};p.discoveryDistance=50;expect(assessSommelierReadiness(p).reasons).toContain('NO_VERIFIED_LOT_EVIDENCE');});
 it('rejects null and synthetic records',()=>{expect(assessSommelierReadiness(null).eligible).toBe(false);expect(assessSommelierReadiness({sourceSku:'TEST-WEIGHT'}).reasons).toContain('NOT_REAL_CATALOGUE_RECORD');});
});
