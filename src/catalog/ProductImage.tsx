import {useState} from 'react';
import {Leaf} from 'lucide-react';
import {productImage,imageView,type ImageProduct,type GalleryImage} from './images';
export default function ProductImage({product,eager=false,asset,sizes='(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 33vw'}:{product:ImageProduct;eager?:boolean;asset?:GalleryImage;sizes?:string}){
 const image=asset?imageView(asset,product.sku):productImage(product),[failed,setFailed]=useState<string|null>(null),show=!!image.src&&failed!==image.src;
 const packshot=product.sku.startsWith('PHOTO-')&&(!asset||asset.role==='primary');
 return <div className={`tea-image${packshot?' tea-image--packshot':''}${product.sku.startsWith('LIST-')?' tea-image--loose-leaf':''}`} data-image-state={show?'image':'placeholder'}>{show?<img src={image.src!} srcSet={image.srcSet} sizes={image.srcSet?sizes:undefined} alt={image.alt} loading={eager?'eager':'lazy'} decoding="async" width={asset?.width??1200} height={asset?.height??1200} onError={()=>setFailed(image.src)}/>:<div className="neutral-tea-image" role="img" aria-label={`Зображення ${product.name} ще готуємо`}><Leaf size={44} strokeWidth={.7} aria-hidden="true"/><span>Зображення готуємо</span></div>}</div>;
}
