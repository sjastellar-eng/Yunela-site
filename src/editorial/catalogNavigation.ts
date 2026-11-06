import type {ContentProduct} from '../catalog/presentation';
export const teaCategories=[['ALL','Увесь чай'],['SHU','Шу пуер'],['SHEN','Шен пуер'],['Улуни','Улуни'],['Червоний чай','Червоний чай'],['Зелений','Зелений чай'],['Білий','Білий чай']] as const;
/** Read the existing declared/observed type, never infer from tasting prose or a picture. */
export function matchesTeaCategory(p:ContentProduct,id:string):boolean {
 const c=p.contentV2;
 if(id==='ALL')return true;
 if(id==='SHU'||id==='SHEN')return c?.evidence.category?.status==='OBSERVED_LABEL'&&c.variety===(id==='SHU'?'Шу пуер':'Шен пуер');
 if(id==='LIGHT_OOLONG')return p.sku==='LIST-022'&&p.family==='Улуни'&&c?.evidence.category?.status==='DECLARED_SUPPLIER'&&/світлий улун/u.test(c.content.processing);
 return p.family===id||(id==='PUER'&&/пуер|пуэр/iu.test(p.family));
}
export const firstTeaSkus=['LIST-001','LIST-005','LIST-022'];
export const collectionDefinitions=[{id:'first',title:'Мій перший китайський чай',skus:firstTeaSkus,copy:'Три заявлені напрями: білий, червоний і світлий улун. Порівняй описи, а не рейтинги.'}];
export function relatedTeaReason(p:ContentProduct,other:ContentProduct):string|null {
 const c=p.contentV2,o=other.contentV2;
 if(p.sku===other.sku||!c||!o||!['OBSERVED_LABEL','DECLARED_SUPPLIER'].includes(c.evidence.category?.status)||!['OBSERVED_LABEL','DECLARED_SUPPLIER'].includes(o.evidence.category?.status)||c.category!==o.category)return null;
 return `Для порівняння в межах заявленого напряму «${o.category}». Смак і доступність партії ще уточнюємо.`;
}
export function parseEditorialRoute(hash:string):{page:string;category:string;collection:string} {
 const value=hash.replace(/^#\//u,'');
 const [route,...rest]=value.split('/');
 let id='';try{id=decodeURIComponent(rest.join('/'));}catch{return {page:'not-found',category:'ALL',collection:''};}
 if(route==='tea')return {page:'catalog',category:[...teaCategories.map(x=>x[0]),'PUER','LIGHT_OOLONG'].includes(id)?id:'ALL',collection:''};
 if(route==='collection')return {page:'catalog',category:'ALL',collection:collectionDefinitions.some(x=>x.id===id)?id:''};
 if(route==='journal'&&id)return {page:'article:'+id,category:'ALL',collection:''};
 if(['catalog','finder','teaware','gifts','journal','about','delivery','returns','contacts','selection','cart','status','operator','checkout','special'].includes(route))return {page:route,category:'ALL',collection:''};
 return {page:value?'not-found':'catalog',category:'ALL',collection:''};
}
