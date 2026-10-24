import {useState} from 'react';
import ProductImage from './ProductImage';
import {productGallery,type ImageProduct} from './images';
const labels:Record<string,string>={primary:'Основне зображення',secondary:'Інший ракурс',texture:'Фактура',illustration:'AI-ілюстрація',illustration_texture:'AI-фактура'};
export default function ProductGallery({product}:{product:ImageProduct}){
 const images=productGallery(product),[active,setActive]=useState(0),selected=images[active]??images[0];
 return <div className="product-gallery" data-primary={product.image??''} aria-label="Галерея чаю"><div className="gallery-stage"><ProductImage product={product} asset={selected} eager sizes="(max-width: 700px) 100vw, 50vw"/></div>{images.length>1&&<><div className="gallery-thumbnails" aria-label="Оберіть зображення">{images.map((img,index)=><button key={img.path} aria-label={`${labels[img.role]??'Зображення'} ${index+1}`} aria-pressed={index===active} onClick={()=>setActive(index)}><ProductImage product={product} asset={img} sizes="72px"/></button>)}</div><p className="gallery-caption" aria-live="polite">{active+1} / {images.length} · {labels[selected?.role]??'Зображення'}{selected?.kind==='ILLUSTRATIVE'?' — не фото конкретної партії.':''}</p></>}</div>;
}
