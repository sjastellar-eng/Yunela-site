import {useState} from 'react';
import {Leaf} from 'lucide-react';
import {productImage,type ImageProduct} from './images';
export default function ProductImage({product,eager=false}:{product:ImageProduct;eager?:boolean}){
 const image=productImage(product),[failed,setFailed]=useState<string|null>(null);const show=!!image.src&&failed!==image.src;
 return <div className="tea-image" data-image-state={show?'image':'placeholder'}>{show?<img src={image.src!} alt={image.alt} loading={eager?'eager':'lazy'} decoding="async" width={600} height={600} onError={()=>setFailed(image.src)}/>:<div className="neutral-tea-image" role="img" aria-label={`Зображення ${product.name} ще готуємо`}><Leaf size={44} strokeWidth={.7} aria-hidden="true"/><span>Зображення готуємо</span></div>}{show&&image.illustrative&&<span className="image-status">Ілюстрація</span>}</div>;
}
