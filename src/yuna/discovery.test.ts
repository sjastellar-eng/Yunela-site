import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {EMPTY_PROFILE,interpretMessage,discoverStyles,readProfile,compareProducts} from './discovery';
const products=JSON.parse(readFileSync('public/demo-catalog.json','utf8')).items;
describe('YUNA editorial discovery',()=>{
 it('links only real records with references and zero verified recommendations',()=>{const r=discoverStyles(products,{...EMPTY_PROFILE});expect(r.items.length).toBeGreaterThan(0);for(const p of r.items)expect(products.some((x:{sku:string})=>x.sku===p.sku)).toBe(true);expect(r.verifiedRecommendations).toBe(0);expect(r.mode).toBe('EDITORIAL_DISCOVERY_ONLY');});
 it('honours category and retains prior answers',()=>{const p=interpretMessage('Хочу улун',{...EMPTY_PROFILE,taste:'М’який напрям',avoidBitter:true}).profile;expect(p.taste).toBe('М’який напрям');expect(p.avoidBitter).toBe(true);expect(discoverStyles(products,p).items.every(x=>x.contentV2?.category==='Улун')).toBe(true);});
 it('recognises no bitterness without claiming a measured property',()=>{const x=interpretMessage('Не люблю гіркоту',EMPTY_PROFILE);expect(x.profile.avoidBitter).toBe(true);expect(x.message).toContain('не підтверджено');});
 it('does not fabricate an answer to unsupported or medical questions',()=>{expect(interpretMessage('який вилікує тиск',EMPTY_PROFILE).message).toContain('не визначаю лікувальні');expect(interpretMessage('купити за 100 гривень',EMPTY_PROFILE).message).toContain('не веду довільний AI-діалог');});
 it('returns an honest empty dataset instead of fixtures',()=>{expect(discoverStyles([],EMPTY_PROFILE).items).toEqual([]);expect(discoverStyles(products.map((p:object)=>({...p,testFixture:true})),EMPTY_PROFILE).items).toEqual([]);});
 it('excludes identity-only unknown tea types',()=>{const r=discoverStyles(products,EMPTY_PROFILE);expect(r.items.every(x=>x.contentV2?.contentStatus==='READY_WITH_DISCLOSURE')).toBe(true);});
 it('offers alternatives without changing IDs or merging duplicate names',()=>{const p={...EMPTY_PROFILE,family:'Пуер'};const a=discoverStyles(products,p),b=discoverStyles(products,p,3);expect(a.items.map(x=>x.sku)).not.toEqual(b.items.map(x=>x.sku));expect(new Set(b.items.map(x=>x.sku)).size).toBe(b.items.length);});
 it('rejects corrupt, huge, future or fake persisted profiles',()=>{for(const s of ['{','x'.repeat(1600),JSON.stringify({...EMPTY_PROFILE,version:'future'}),JSON.stringify({...EMPTY_PROFILE,family:'TEST'})])expect(readProfile(s)).toBeNull();expect(readProfile(JSON.stringify(EMPTY_PROFILE))).toEqual(EMPTY_PROFILE);});
 it('comparison retains caveats and identifies each source record',()=>{const pair=compareProducts(products[0],products[1]);expect(pair[0].sku).toBe(products[0].sku);expect(pair.every(p=>p.scope.includes('не продегустовано'))).toBe(true);});
 it('numeric preference does not produce invented batch scores',()=>{const a=discoverStyles(products,{...EMPTY_PROFILE,intensity:'Легка'}),b=discoverStyles(products,{...EMPTY_PROFILE,intensity:'Виразна'});expect(a.items.map(x=>x.sku)).toEqual(b.items.map(x=>x.sku));expect('score' in a.items[0]).toBe(false);});
});
