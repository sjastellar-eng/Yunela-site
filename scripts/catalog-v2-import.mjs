import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,renameSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export function parseCsv(input){
 const text=input.replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
  if(c==='"'){if(field||closed)throw Error('Malformed CSV quote');quoted=true;}else if(c===','||c==='\n'||c==='\r'){row.push(field);field='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(x=>x!==''))rows.push(row);row=[];}}else{if(closed)throw Error('Characters after CSV quote');field+=c;}}
 if(quoted)throw Error('Unclosed CSV quote');if(field||row.length){row.push(field);rows.push(row);}const header=rows.shift();if(!header||new Set(header).size!==header.length)throw Error('Invalid headers');
 return rows.map(r=>{if(r.length!==header.length)throw Error('CSV column mismatch');return Object.fromEntries(header.map((k,i)=>[k,r[i]]));});
}
const expected=()=>[...Array.from({length:30},(_,i)=>`PHOTO-${String(i+1).padStart(3,'0')}`),...Array.from({length:26},(_,i)=>`LIST-${String(i+1).padStart(3,'0')}`)];
const digest=x=>createHash('sha256').update(x).digest('hex');
const required=(v,label)=>{if(typeof v!=='string'||!v.trim())throw Error('Missing '+label);return v;};
const bool=v=>{if(v!=='true'&&v!=='false')throw Error('Invalid boolean');return v==='true';};
const list=v=>v?v.split(';').map(s=>s.trim()).filter(Boolean):[];
function unique(rows,key){const map=new Map();for(const r of rows){if(map.has(r[key]))throw Error('Duplicate '+key+': '+r[key]);map.set(r[key],r);}return map;}
export function validateImageManifest(manifest,skuSet,publicDir){
 const bySku=unique(manifest.images,'sourceSku');for(const [sku,img]of bySku){if(!skuSet.has(sku))throw Error('Unknown image SKU');if(img.path===null){if(img.publicationAllowed!==false)throw Error('Empty image cannot be approved');continue;}
 if(!/^\/creative\/(?:LIST|PHOTO)-\d{3}[A-Za-z0-9_-]*\.(?:webp|png|jpg)$/.test(img.path)||!['COMMERCIAL_USE_APPROVED'].includes(img.rightsStatus)||img.assignmentStatus!=='APPROVED_FOR_SKU'||img.publicationAllowed!==true||!['EDITORIAL_ILLUSTRATION','ILLUSTRATIVE','VERIFIED_PRODUCT_PHOTO','SUPPLIER_PRODUCT_PHOTO'].includes(img.kind)||!img.alt?.trim())throw Error('Image rights/assignment/path not approved');
 if(img.kind==='SUPPLIER_PRODUCT_PHOTO'&&(img.supplierAuthorized!==true||img.rightsEvidenceId!=='CEO_SUPPLIER_PERMISSION_2026_10_23'))throw Error('Supplier authorization missing');
 if(img.kind==='VERIFIED_PRODUCT_PHOTO'&&img.productIdentityConfirmed!==true)throw Error('Product photo identity unconfirmed');
 if(!new RegExp('^/creative/'+sku+'(?:[-_][A-Za-z0-9_-]+)?\\.(?:webp|png|jpg)$').test(img.path))throw Error('Image filename must match sourceSku');
 const file=resolve(publicDir,'.'+img.path);if(!existsSync(file)||digest(readFileSync(file))!==img.sha256)throw Error('Image file/checksum mismatch');
 }return bySku;
}
export function buildCatalogue({csvText,intelligence,base,imageManifest,publicDir='public'}){
 const rows=parseCsv(csvText),csv=unique(rows,'source_sku'),records=unique(intelligence.records,'sourceSku'),old=unique(base.items,'sku');const keys=expected();
 for(const map of [csv,records,old])if(map.size!==56||keys.some(k=>!map.has(k)))throw Error('Expected exact 56 stable source SKUs');
 if(intelligence.schemaVersion!=='yunela-tea-intelligence-v2'||intelligence.dataClass!=='INTERNAL_CONTENT_PRODUCTION_NOT_PUBLIC_MANIFEST')throw Error('Unsupported source schema');
 const ids=new Set(intelligence.sources.map(x=>x.id));const images=validateImageManifest(imageManifest,new Set(keys),publicDir);
 const familyMap={'Пуер':'PUER','Улун':'Улуни','Червоний чай':'Червоний чай','Білий чай':'Білий','Зелений чай':'Зелений','Тип чаю не встановлено':'UNKNOWN'};
 const result=keys.map(sku=>{const row=csv.get(sku),record=records.get(sku),previous=old.get(sku);
  for(const [a,b]of [['name_ua','nameUA'],['canonical_tea_id','canonicalTeaId'],['category_ua','category']])if(row[a]!==record[b])throw Error('CSV/JSON mismatch '+sku+' '+a);
  const texts={short:'short_description_ua',full:'full_description_ua',aroma:'aroma_notes_ua',taste:'taste_description_ua',finish:'finish_ua',processing:'processing_ua',brewing:'brewing_ua',buyerProfile:'buyer_profile_ua'};
  for(const[k,col]of Object.entries(texts))if(row[col]!==record.contentUA[k])throw Error('CSV/JSON text mismatch '+sku+' '+k);
  for(const[k,c]of [['publishAllowed','publish_allowed'],['salesAllowed','sales_allowed'],['recommendationApproved','recommendation_approved']])if(bool(row[c])!==record[k]||record[k]!==false)throw Error('V2 import cannot grant publication, sales or recommendation approval');
  if(Object.values(record.sensory).some(x=>x!==null)||record.discoveryDistance!==null||record.verifiedFields.length)throw Error('Unexpected batch sensory: separate reviewed adapter required');
  const sourceIds=list(row.source_ids);if(sourceIds.some(id=>!ids.has(id))||JSON.stringify(sourceIds)!==JSON.stringify(record.sourceIds))throw Error('Broken source references '+sku);
  const evidence=JSON.parse(row.confidence_json);if(JSON.stringify(evidence)!==JSON.stringify(record.evidenceByContentField))throw Error('Evidence mismatch '+sku);
  const duplicates=list(row.possible_duplicate_group_ids);if(JSON.stringify(duplicates)!==JSON.stringify(record.possibleDuplicateGroupIds))throw Error('Duplicate mapping mismatch');
  if(!(row.category_ua in familyMap))throw Error('Unknown category');
  const img=images.get(sku);const approved=img?.path?img:null;
  return {...previous,name:required(row.name_ua,'name'),family:familyMap[row.category_ua],image:approved?approved.path:previous.image,price:null,stock:null,confirmed:false,availability:'REQUEST',commercial:null,
   contentV2:{sourceSku:sku,canonicalTeaId:record.canonicalTeaId,canonicalStatus:record.canonicalStatus,supplierReference:record.supplierReference,originalSourceName:record.originalSourceName,chineseNameOriginal:record.chineseNameOriginal,chineseNameReference:record.chineseNameReference,chineseNameReferenceStatus:record.chineseNameReferenceStatus,category:record.category,legacyCatalogCategory:record.legacyCatalogCategory,taxonomyFamily:record.taxonomyFamily,variety:record.variety,contentStatus:record.contentStatus,sensoryScope:row.sensory_scope,sourceIds,sourceUrls:list(row.source_urls).filter(u=>/^https:\/\//.test(u)),possibleDuplicateGroupIds:duplicates,evidence,content:record.contentUA,recipe:record.styleGuidance.recipe??null,sensory:record.sensory,discoveryDistance:null,verifiedFields:[],publishAllowed:false,salesAllowed:false,recommendationApproved:false,previewOnly:true,image:approved??{kind:'SUPPLIER_PRODUCT_PHOTO',rightsStatus:record.image?.rightsStatus??'UNKNOWN',publicationAllowed:record.image?.publicationAllowed??false,assignmentStatus:record.image?.assignmentStatus??'UNASSIGNED'}}};});
 const sources=intelligence.sources.map(({id,title,publisherOrType,accessStatus,location})=>({id,title,type:publisherOrType,accessStatus,url:/^https:\/\//.test(location)?location:null}));
 const catalog={schemaVersion:'yunela-informational-catalogue-v2',mode:'INFORMATIONAL_DEMO_ONLY',sourceSchema:intelligence.schemaVersion,sourceGeneratedAt:intelligence.generatedAt,items:result,sources,duplicateReview:intelligence.duplicateReview};
 return {catalog,summary:{records:result.length,sourceSkus:result.map(x=>x.sku),contentReady:result.filter(x=>x.contentV2.contentStatus==='READY_WITH_DISCLOSURE').length,duplicateGroups:intelligence.duplicateReview.groups.length,eligibleRecommendations:0,commerceEnabled:false}};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const args=process.argv.slice(2);const option=k=>args.includes(k)?args[args.indexOf(k)+1]:undefined;for(const k of ['--csv','--sensory'])if(!args.includes(k))throw Error('Required '+k);
 const csvText=readFileSync(option('--csv'),'utf8'),raw=readFileSync(option('--sensory'),'utf8'),base=JSON.parse(readFileSync('public/demo-catalog.json','utf8')),imageManifest=JSON.parse(readFileSync(option('--images')??'content/creative-images.v1.json','utf8'));
 const {catalog,summary}=buildCatalogue({csvText,intelligence:JSON.parse(raw),base,imageManifest});
 const bytes=JSON.stringify(catalog,null,2)+'\n',target='public/demo-catalog.json';const same=readFileSync(target,'utf8')===bytes;
 console.log(JSON.stringify({...summary,dryRun:!args.includes('--apply'),change:same?'UNCHANGED':'UPDATE',sourceHashes:{csv:digest(csvText),sensory:digest(raw)}},null,2));
 if(args.includes('--apply')&&!same){writeFileSync(target+'.tmp',bytes);renameSync(target+'.tmp',target);}
}
