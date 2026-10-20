import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import { ApplicationError } from './errors';
import { DEVELOPMENT_POLICY,validatePolicy,validateCurve,type Curve,type Policy } from './flexiblePricing';
import { seedPartnerOffer,syncCommerceProduct } from './partnerStore';
export type CommercialRecord={sourceSku:string;canonicalTeaId:string|null;name:string;family:string;image:string|null;lot:string|null;version:string;curve:Curve|null;stockGrams:number|null;testFixture:boolean;approvedForTest:boolean;packaging:string|null;metadata?:Record<string,unknown>};
const stable=(v:unknown):string=>JSON.stringify(v,(_k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
export const digest=(v:unknown)=>createHash('sha256').update(stable(v)).digest('hex');
const invalid=(m:string):never=>{throw new ApplicationError('VALIDATION_ERROR',m);};
export function installPolicy(db:Database.Database,p:Policy){validatePolicy(p);const old=db.prepare('SELECT payload_json FROM commercial_policies WHERE version=?').get(p.version) as {payload_json:string}|undefined;if(old&&digest(JSON.parse(old.payload_json))!==digest(p))return invalid('Policy version is immutable');db.transaction(()=>{db.prepare('UPDATE commercial_policies SET active=0').run();db.prepare('INSERT INTO commercial_policies VALUES(?,?,1) ON CONFLICT(version) DO UPDATE SET active=1').run(p.version,JSON.stringify(p));})();}
export function getPolicy(db:Database.Database):Policy{const row=db.prepare('SELECT payload_json FROM commercial_policies WHERE active=1').get() as {payload_json:string}|undefined;return row?JSON.parse(row.payload_json):DEVELOPMENT_POLICY;}
export function getCommercial(db:Database.Database,sku:string):CommercialRecord|undefined{const r=db.prepare('SELECT payload_json FROM commercial_records WHERE source_sku=?').get(sku) as {payload_json:string}|undefined;return r?JSON.parse(r.payload_json):undefined;}
export function allowed(r:CommercialRecord){return r.testFixture===true&&r.approvedForTest===true&&!!r.canonicalTeaId&&r.canonicalTeaId!=='UNKNOWN'&&!!r.lot&&r.lot!=='UNKNOWN'&&!!r.curve&&r.stockGrams!==null&&!!r.packaging&&r.packaging!=='UNKNOWN';}
export function importCatalog(db:Database.Database,input:unknown,dryRun:boolean,actor:string){
 if(!Array.isArray(input)||!input.length||input.length>1000)return invalid('Expected 1–1000 commercial records');const seen=new Set<string>();
 const rows=input.map(raw=>{if(!raw||typeof raw!=='object')return invalid('Invalid row');const v=raw as CommercialRecord;
 if(!/^[A-Za-z0-9_-]{1,80}$/.test(v.sourceSku)||seen.has(v.sourceSku))return invalid('Duplicate/invalid sourceSku');seen.add(v.sourceSku);
 for(const k of ['name','family','version'] as const)if(typeof v[k]!=='string'||!v[k].trim()||v[k].length>200)return invalid('Missing '+k);
 for(const k of ['canonicalTeaId','lot','packaging','image'] as const)if(v[k]!==null&&(typeof v[k]!=='string'||!v[k]?.trim()||v[k]!.length>500))return invalid('Expected string or NULL: '+k);
 if(v.image!==null&&!/^\/catalog\/[A-Za-z0-9_.-]+\.(jpg|png|webp)$/.test(v.image))return invalid('Unsafe image');
 if(typeof v.testFixture!=='boolean'||typeof v.approvedForTest!=='boolean')return invalid('Explicit approval flags required');
 if(v.stockGrams!==null&&(!Number.isSafeInteger(v.stockGrams)||v.stockGrams<0))return invalid('Invalid gram stock');if(v.curve!==null)validateCurve(v.curve);
 if(v.approvedForTest&&!allowed(v))return invalid('Approval requires synthetic fixture, canonical id, lot, curve, stock and packaging');
 const old=getCommercial(db,v.sourceSku),hash=digest(v);if(old&&old.version===v.version&&digest(old)!==hash)return invalid('Record version is immutable: '+v.sourceSku);
 if(old?.approvedForTest && ['canonicalTeaId','lot','curve','stockGrams','packaging'].some(k=>(v as unknown as Record<string,unknown>)[k]===null))return invalid('NULL cannot erase approved fields');
 const reserved=db.prepare('SELECT reserved_grams FROM commercial_records WHERE source_sku=?').get(v.sourceSku) as {reserved_grams:number}|undefined;if(reserved?.reserved_grams&&(v.stockGrams===null||v.stockGrams<reserved.reserved_grams))return invalid('Stock below reservations');
 return {value:v,hash,change:old?digest(old)===hash?'UNCHANGED':'UPDATE':'CREATE'};});
 const result={dryRun,changes:rows.map(r=>({sourceSku:r.value.sourceSku,change:r.change,sellableInTest:allowed(r.value)})),realPublishingEnabled:false};if(dryRun)return result;
 db.transaction(()=>{for(const{value:v,hash,change}of rows){if(change==='UNCHANGED')continue;seedPartnerOffer(db,{sku:v.sourceSku,name:v.name});const yes=allowed(v);
 db.prepare('UPDATE partner_catalog SET name=?,family=?,image_path=?,retail_amount=?,stock=?,confirmed=?,availability=?,test_fixture=?,packaging=?,updated_at=? WHERE sku=?').run(v.name,v.family,v.image,yes?v.curve!.pWhole:null,yes?Math.floor(v.stockGrams!/v.curve!.wholeGrams):null,yes?1:0,yes?'IN_STOCK':'REQUEST',v.testFixture?1:0,v.packaging??'UNKNOWN',new Date().toISOString(),v.sourceSku);
 db.prepare('INSERT INTO commercial_records(source_sku,version,payload_json,digest,stock_grams) VALUES(?,?,?,?,?) ON CONFLICT(source_sku) DO UPDATE SET version=excluded.version,payload_json=excluded.payload_json,digest=excluded.digest,stock_grams=excluded.stock_grams').run(v.sourceSku,v.version,JSON.stringify(v),hash,v.stockGrams);
 syncCommerceProduct(db,v.sourceSku);if(yes)for(const format of ['WEIGHT','WHOLE'])db.prepare("INSERT INTO commercial_products(sku,kind,name,price_amount,price_currency,tea_id,available) VALUES(?,'TEA',?,?,'UAH',?,1) ON CONFLICT(sku) DO UPDATE SET name=excluded.name,available=1").run(v.sourceSku+'::'+format,v.name,v.curve!.pWhole,v.sourceSku);
 }db.prepare('INSERT OR IGNORE INTO commercial_imports VALUES(?,?,?)').run(digest(rows.map(r=>r.value)),actor,new Date().toISOString());})();return result;
}
export const syntheticCommercial:CommercialRecord={sourceSku:'TEST-WEIGHT',canonicalTeaId:'SYNTHETIC-TEA',name:'Тест ваги — не реальна пропозиція',family:'UNKNOWN',image:null,lot:'SYNTHETIC-LOT',version:'SYNTHETIC-1',curve:{wholeGrams:357,supplierWholeMinor:10000,p25:20000,p50:35000,p100:60000,pWhole:120000},stockGrams:100000,testFixture:true,approvedForTest:true,packaging:'TEST-PACK-V1'};
