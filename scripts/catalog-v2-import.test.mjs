import {describe,it,expect} from 'vitest';
import {parseCsv,validateImageManifest} from './catalog-v2-import.mjs';
describe('safe catalogue input',()=>{
 it('reads BOM, quoted multiline Ukrainian text and escaped quotes',()=>{expect(parseCsv('\uFEFFsku,text\r\nLIST-001,"Чай\n""опис"""\r\n')).toEqual([{sku:'LIST-001',text:'Чай\n"опис"'}]);});
 it.each(['a,a\n1,2','a,b\n1','a\n"unfinished','a\n"closed"extra'])('rejects malformed CSV %s',text=>expect(()=>parseCsv(text)).toThrow());
 it('rejects unknown image assignments',()=>expect(()=>validateImageManifest({images:[{sourceSku:'FAKE'}]},new Set(['LIST-001']),'public')).toThrow());
 it('rejects image use without confirmed rights',()=>expect(()=>validateImageManifest({images:[{sourceSku:'LIST-001',path:'/creative/LIST-001.jpg',publicationAllowed:true,rightsStatus:'UNKNOWN'}]},new Set(['LIST-001']),'public')).toThrow());
});
