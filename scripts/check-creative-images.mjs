import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {validateImageManifest} from './catalog-v2-import.mjs';
const catalog=JSON.parse(readFileSync('public/demo-catalog.json','utf8')),manifest=JSON.parse(readFileSync('content/creative-images.v1.json','utf8'));
const images=validateImageManifest(manifest,new Set(catalog.items.map(p=>p.sku)),'public');let count=0;
for(const img of images.values()){if(!img.path)continue;const file=resolve('public','.'+img.path),bytes=readFileSync(file);if(statSync(file).size>2*1024*1024)throw Error('Image exceeds 2 MiB: '+img.sourceSku);
 const valid=img.path.endsWith('.webp')?bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP':img.path.endsWith('.png')?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(!valid)throw Error('Image file signature mismatch: '+img.sourceSku);count++;}
console.log(JSON.stringify({status:'PASS',catalog:catalog.items.length,creativeImages:count,pending:[...images.values()].filter(i=>!i.path).length}));
