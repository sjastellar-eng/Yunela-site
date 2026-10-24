import manifest from '../../content/creative-images.v1.json';
import gallery from '../../content/creative-gallery.v1.json';
import type {CatalogContentV2} from '../contracts/catalogContent';
export interface ImageProduct {sku:string;name:string;image:string|null;contentV2?:CatalogContentV2;creativeImage?:CreativeImage}
export interface CreativeImage {sourceSku:string;path:string|null;kind:string|null;rightsStatus:string;assignmentStatus:string;publicationAllowed:boolean;alt:string|null;sha256:string|null;productIdentityConfirmed?:boolean;supplierAuthorized?:boolean;rightsEvidenceId?:string}
export interface ImageVariant {path:string;width:number;sha256:string}
export interface GalleryImage extends CreativeImage {path:string;sha256:string;role:string;width:number;height:number;variants:ImageVariant[]}
export interface GalleryProduct {sourceSku:string;primary:string|null;images:GalleryImage[]}
export function approvedCreative(img:CreativeImage,sku:string):boolean{
 const kind=['EDITORIAL_ILLUSTRATION','ILLUSTRATIVE'].includes(img.kind??'')||(img.kind==='VERIFIED_PRODUCT_PHOTO'&&img.productIdentityConfirmed===true)||(img.kind==='SUPPLIER_PRODUCT_PHOTO'&&img.supplierAuthorized===true&&img.rightsEvidenceId==='CEO_SUPPLIER_PERMISSION_2026_10_23');
 return img.sourceSku===sku&&!!img.path&&new RegExp('^/creative/'+sku+'(?:[-_][A-Za-z0-9_-]+)?\\.(?:webp|png|jpg)$').test(img.path)&&img.publicationAllowed===true&&img.rightsStatus==='COMMERCIAL_USE_APPROVED'&&img.assignmentStatus==='APPROVED_FOR_SKU'&&!!img.alt?.trim()&&/^[a-f0-9]{64}$/i.test(img.sha256??'')&&kind;
}
export function withCreativeImages<T extends ImageProduct>(items:T[],data:{images:CreativeImage[]}=manifest):T[]{
 const counts=new Map<string,number>();for(const x of data.images)counts.set(x.sourceSku,(counts.get(x.sourceSku)??0)+1);
 return items.map(p=>{const img=data.images.find(x=>x.sourceSku===p.sku);if(!img)return p;
  if(counts.get(p.sku)!==1||!approvedCreative(img,p.sku))return{...p,image:null,creativeImage:undefined,...(p.contentV2?{contentV2:{...p.contentV2,image:{...p.contentV2.image,path:undefined,publicationAllowed:false}}}:{})};
  return{...p,image:img.path,creativeImage:img,...(p.contentV2?{contentV2:{...p.contentV2,image:{...img,kind:img.kind!,alt:img.alt!,path:img.path!}}}:{})};});
}
const versioned=(p:string,s:string)=>p+'?v='+s.slice(0,16);
export function imageView(img:GalleryImage,sku:string){
 const valid=approvedCreative(img,sku),variants=valid?img.variants.filter(v=>v.path!==img.path&&Number.isInteger(v.width)&&v.width>0&&v.width<img.width&&approvedCreative({...img,path:v.path,sha256:v.sha256},sku)):[];
 return{src:valid?versioned(img.path,img.sha256):null,alt:img.alt??sku,illustrative:['ILLUSTRATIVE','EDITORIAL_ILLUSTRATION'].includes(img.kind??''),srcSet:variants.length?[...variants,{path:img.path,sha256:img.sha256,width:img.width}].sort((a,b)=>a.width-b.width).map(v=>`${versioned(v.path,v.sha256)} ${v.width}w`).join(', '):undefined};
}
export function productImage(p:ImageProduct):{src:string|null;alt:string;illustrative:boolean;srcSet?:string}{
 const meta=p.creativeImage??p.contentV2?.image;
 if(p.image?.startsWith('/creative/')){
  if(meta?.sourceSku&&meta.sourceSku!==p.sku)return{src:null,alt:p.name,illustrative:false};
  const record={...meta,sourceSku:p.sku,path:p.image} as CreativeImage;if(!approvedCreative(record,p.sku))return{src:null,alt:p.name,illustrative:false};
  const primary=gallery.products.find(g=>g.sourceSku===p.sku)?.images.find(a=>a.role==='primary'&&a.path===p.image&&a.sha256===record.sha256);
  return primary?imageView(primary,p.sku):{src:versioned(p.image,record.sha256!),alt:record.alt!,illustrative:['ILLUSTRATIVE','EDITORIAL_ILLUSTRATION'].includes(record.kind??'')};
 }
 return{src:p.image&&/^\/catalog\/[A-Za-z0-9_-]+\.(?:jpg|webp)$/i.test(p.image)?p.image.replace(/\.jpg$/i,'.webp'):null,alt:p.name,illustrative:false};
}
export function productGallery(p:ImageProduct,data:{products:GalleryProduct[]}=gallery):GalleryImage[]{
 const matches=data.products.filter(g=>g.sourceSku===p.sku);if(matches.length!==1||!productImage(p).src||matches[0].primary!==p.image)return[];
 const entries=matches[0].images,first=entries[0];
 if(!first||!approvedCreative(first,p.sku)||first.role!=='primary'||first.path!==p.image||first.sha256!==(p.creativeImage??p.contentV2?.image)?.sha256||new Set(entries.map(x=>x.path)).size!==entries.length)return[];
 return entries.filter(x=>approvedCreative(x,p.sku));
}
