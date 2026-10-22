import manifest from '../../content/creative-images.v1.json';
import type {CatalogContentV2} from '../contracts/catalogContent';
export interface ImageProduct {sku:string;name:string;image:string|null;contentV2?:CatalogContentV2}
export interface CreativeImage {sourceSku:string;path:string|null;kind:string|null;rightsStatus:string;assignmentStatus:string;publicationAllowed:boolean;alt:string|null;sha256:string|null;productIdentityConfirmed?:boolean}
export function approvedCreative(img:CreativeImage,sku:string):boolean{
 return img.sourceSku===sku&&!!img.path&&new RegExp('^/creative/'+sku+'(?:[-_][A-Za-z0-9_-]+)?\\.(?:webp|png|jpg)$').test(img.path)&&img.publicationAllowed===true&&img.rightsStatus==='COMMERCIAL_USE_APPROVED'&&img.assignmentStatus==='APPROVED_FOR_SKU'&&!!img.alt?.trim()&&/^[a-f0-9]{64}$/i.test(img.sha256??'')&&(['EDITORIAL_ILLUSTRATION','ILLUSTRATIVE'].includes(img.kind??'')||(img.kind==='VERIFIED_PRODUCT_PHOTO'&&img.productIdentityConfirmed===true));
}
export function withCreativeImages<T extends ImageProduct>(items:T[],data:{images:CreativeImage[]}=manifest):T[]{
 const counts=new Map<string,number>();for(const x of data.images)counts.set(x.sourceSku,(counts.get(x.sourceSku)??0)+1);
 return items.map(p=>{const img=data.images.find(x=>x.sourceSku===p.sku);if(!p.contentV2||!img||counts.get(p.sku)!==1||!approvedCreative(img,p.sku))return p;
  return{...p,image:img.path,contentV2:{...p.contentV2,image:{...img,kind:img.kind!,alt:img.alt!,path:img.path!}}};});
}
export function productImage(p:ImageProduct):{src:string|null;alt:string;illustrative:boolean}{
 const meta=p.contentV2?.image;
 if(p.image?.startsWith('/creative/')){if(meta?.sourceSku&&meta.sourceSku!==p.sku)return{src:null,alt:p.name,illustrative:false};const record={...meta,sourceSku:p.sku,path:p.image} as CreativeImage;return{src:approvedCreative(record,p.sku)?p.image+'?v='+record.sha256!.slice(0,16):null,alt:meta?.alt||p.name,illustrative:['ILLUSTRATIVE','EDITORIAL_ILLUSTRATION'].includes(meta?.kind??'')};}
 const source=p.image&&/^\/catalog\/[A-Za-z0-9_-]+\.(?:jpg|webp)$/i.test(p.image)?p.image.replace(/\.jpg$/i,'.webp'):null;
 return{src:source,alt:p.name,illustrative:false};
}
