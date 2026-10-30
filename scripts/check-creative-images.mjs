import {readFileSync,statSync} from 'node:fs';
import {resolve} from 'node:path';
import {validateImageManifest} from './catalog-v2-import.mjs';
const catalog=JSON.parse(readFileSync('public/demo-catalog.json','utf8')),manifest=JSON.parse(readFileSync('content/creative-images.v1.json','utf8'));
const images=validateImageManifest(manifest,new Set(catalog.items.map(p=>p.sku)),'public');let count=0;
for(const img of images.values()){if(!img.path)continue;const file=resolve('public','.'+img.path),bytes=readFileSync(file);if(statSync(file).size>2*1024*1024)throw Error('Image exceeds 2 MiB: '+img.sourceSku);
 const valid=img.path.endsWith('.webp')?bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP':img.path.endsWith('.png')?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 if(!valid)throw Error('Image file signature mismatch: '+img.sourceSku);count++;}
console.log(JSON.stringify({status:'PASS',catalog:catalog.items.length,creativeImages:count,pending:[...images.values()].filter(i=>!i.path).length}));
// A valid master must never hide a missing or truncated responsive export.
const gallery=JSON.parse(readFileSync('content/creative-gallery.v1.json','utf8')),seen=new Set(),files=new Set();
if(gallery.products.length!==catalog.items.length)throw Error('Incomplete gallery inventory');
for(const product of gallery.products){
 const primary=images.get(product.sourceSku);if(!primary||seen.has(product.sourceSku)||product.primary!==primary.path)throw Error('Invalid gallery primary assignment');seen.add(product.sourceSku);
 if(!primary.path){if(product.images.length)throw Error('Blocked product cannot expose gallery images');continue;}
 const first=product.images[0];if(!first||first.role!=='primary'||first.path!==primary.path||first.sha256!==primary.sha256)throw Error('Gallery must retain its fixed primary');
 for(const img of product.images){
  if(img.sourceSku!==product.sourceSku)throw Error('Gallery SKU mismatch');
  for(const variant of [img,...img.variants]){
   const entry={...img,path:variant.path,sha256:variant.sha256};validateImageManifest({images:[entry]},new Set([product.sourceSku]),'public');
   const bytes=readFileSync(resolve('public','.'+variant.path));
   if(bytes.length<12||bytes.length>2*1024*1024||bytes.subarray(0,4).toString()!=='RIFF'||bytes.subarray(8,12).toString()!=='WEBP')throw Error('Invalid gallery WebP: '+variant.path);
   if(files.has(variant.path))throw Error('Duplicate gallery image path');files.add(variant.path);
  }
 }
}
console.log(JSON.stringify({status:'PASS',galleryProducts:seen.size,masterAndResponsiveFiles:files.size}));
