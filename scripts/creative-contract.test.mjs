import {describe,it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createHash} from 'node:crypto';import {validateImageManifest} from './catalog-v2-import.mjs';
describe('Creative transport validation, not morphology approval',()=>{
 it('validates actual bytes/checksum and rejects substitutions or missing files',()=>{const root=mkdtempSync(join(tmpdir(),'yunela-image-contract-'));try{mkdirSync(join(root,'creative'));const bytes=Buffer.from([137,80,78,71,13,10,26,10]);writeFileSync(join(root,'creative','LIST-013.png'),bytes);
 const img={sourceSku:'LIST-013',path:'/creative/LIST-013.png',kind:'ILLUSTRATIVE',rightsStatus:'COMMERCIAL_USE_APPROVED',assignmentStatus:'APPROVED_FOR_SKU',publicationAllowed:true,alt:'TEST transport fixture — not a tea photo',sha256:createHash('sha256').update(bytes).digest('hex')};
 expect(validateImageManifest({images:[img]},new Set(['LIST-013']),root).size).toBe(1);
 for(const bad of [{...img,sha256:'0'.repeat(64)},{...img,path:'/creative/LIST-014.png'},{...img,path:'/creative/LIST-013-missing.png'},{...img,publicationAllowed:false},{...img,kind:'VERIFIED_PRODUCT_PHOTO'}])expect(()=>validateImageManifest({images:[bad]},new Set(['LIST-013']),root)).toThrow();
 }finally{rmSync(root,{recursive:true,force:true});}});
});
