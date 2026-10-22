import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {renderToStaticMarkup} from 'react-dom/server';
import ProductDetail from './ProductDetail';
import type {CatalogContentV2} from '../contracts/catalogContent';
import {approvedCreative,withCreativeImages,productImage,type CreativeImage,type ImageProduct} from './images';
import {displayName,productShort,aboutParagraphs,identityNote} from './presentation';
const items=JSON.parse(readFileSync('public/demo-catalog.json','utf8')).items as (ImageProduct&{price:null;stock:null;confirmed:boolean;testFixture:boolean;family:string;contentV2:CatalogContentV2})[];
const base=items.find((p:{sku:string})=>p.sku==='LIST-013')!;
const approved={sourceSku:'LIST-013',path:'/creative/LIST-013-v2.webp',kind:'ILLUSTRATIVE',rightsStatus:'COMMERCIAL_USE_APPROVED',assignmentStatus:'APPROVED_FOR_SKU',publicationAllowed:true,alt:'Ілюстрація для тестування технічного контракту',sha256:'a'.repeat(64)} satisfies CreativeImage;
describe('safe Creative image projection',()=>{
 it('joins approved images by SKU without changing catalog facts or commerce',()=>{const before=JSON.stringify(items);const out=withCreativeImages(items,{images:[approved]});const p=out.find((x:{sku:string})=>x.sku==='LIST-013')!;expect(out).toHaveLength(56);expect(p.image).toBe(approved.path);expect(p.price).toBeNull();expect(p.stock).toBeNull();expect(p.confirmed).toBe(false);expect(p.contentV2.salesAllowed).toBe(false);expect(p.contentV2.evidence).toEqual(base.contentV2.evidence);expect(p.contentV2.content).toEqual(base.contentV2.content);expect(JSON.stringify(items)).toBe(before);expect(out.find((x:{sku:string})=>x.sku==='LIST-014')!.image).toBeNull();});
 it('does not treat an illustration label as approval',()=>{for(const img of [{...approved,publicationAllowed:false},{...approved,rightsStatus:'UNKNOWN'},{...approved,assignmentStatus:'PENDING'},{...approved,sha256:null},{...approved,path:'/creative/LIST-014.webp'},{...approved,path:'https://example.com/LIST-013.webp'},{...approved,kind:'VERIFIED_PRODUCT_PHOTO'}])expect(approvedCreative(img,'LIST-013')).toBe(false);});
 it('fails closed on duplicate assignments',()=>{const out=withCreativeImages([base],{images:[approved,approved]});expect(out[0].image).toBeNull();});
 it('rejects a mismatched product identity and unsafe source path',()=>{expect(productImage({...base,image:approved.path,contentV2:{...base.contentV2,image:{...approved,sourceSku:'LIST-014'}}}).src).toBeNull();expect(productImage({...base,image:'/catalog/../secret.jpg'}).src).toBeNull();});
 it('keeps approved illustration status and exact Creative filename',()=>{const p=withCreativeImages([base],{images:[{...approved,path:'/creative/LIST-013.jpg'}]})[0];expect(productImage(p)).toMatchObject({src:'/creative/LIST-013.jpg?v=aaaaaaaaaaaaaaaa',illustrative:true});});
});
describe('Product Content V2 reader presentation',()=>{
 it('presents all twelve oolongs without changing original text or identity',()=>{const oolongs=items.filter((p:{sku:string})=>/^LIST-0(1[3-9]|2[0-4])$/.test(p.sku));expect(oolongs).toHaveLength(12);for(const p of oolongs){expect(displayName(p).length).toBeGreaterThan(2);expect(productShort(p).length).toBeGreaterThan(10);expect(aboutParagraphs(p.contentV2).length).toBeGreaterThan(0);expect(p.contentV2.recipe).not.toBeNull();expect(p.contentV2.sourceSku).toBe(p.sku);}});
 it('keeps conditional identity and composition caveats',()=>{expect(identityNote(base)).toContain('готовність');expect(identityNote(items.find((p:{sku:string})=>p.sku==='LIST-021')!)).toContain('Склад');expect(aboutParagraphs(base.contentV2).join(' ')).toContain('Можливе прочитання');});
 it('does not merge three Shui Xian entries or invent their differences',()=>{for(const sku of ['LIST-014','LIST-015','LIST-017']){const p=items.find((x:{sku:string})=>x.sku===sku)!;expect(displayName(p)).toBe('Шуй Сянь');expect(p.contentV2.possibleDuplicateGroupIds).toContain('D03');}});
 it('includes actual content, brewing and evidence while keeping checkout absent',()=>{const html=renderToStaticMarkup(<ProductDetail product={base} products={items} saved={false} onSave={()=>{}} onBack={()=>{}} onAsk={()=>{}} onOpen={()=>{}} backLabel="Назад до каталогу"/>);expect(html).toContain('LIST-013');expect(html).toContain('Про цей чай');expect(html).toContain('Смаковий профіль');expect(html).toContain('Як заварювати');expect(html).toContain('Про опис і джерела');expect(html).not.toContain('Оформити');expect(html).toContain('після цього підтвердження');});
});
