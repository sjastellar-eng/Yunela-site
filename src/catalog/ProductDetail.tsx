import {ArrowLeft,ArrowUpRight,Check,Plus} from 'lucide-react';
import type {DiscoveryProduct} from '../yuna/discovery';
import ProductImage from './ProductImage';
import ProductGallery from './ProductGallery';
import {displayName,productShort,identityNote,needsBrewingConfirmation} from './presentation';
import CatalogueContent from '../catalogue-content';
import {relatedTeaReason} from '../editorial/catalogNavigation';
export default function ProductDetail({product,products,saved,onSave,onBack,onAsk,onOpen,backLabel}:{product:DiscoveryProduct;products:DiscoveryProduct[];saved:boolean;onSave:()=>void;onBack:()=>void;onAsk:()=>void;onOpen:(p:DiscoveryProduct)=>void;backLabel:string}){
 const data=product.contentV2,note=identityNote(product);const related=products.filter(p=>!p.testFixture&&relatedTeaReason(product,p)).slice(0,3);
 return <section className="product-page" data-source-sku={product.sku} aria-label="Картка чаю"><div className="product-breadcrumb"><button onClick={onBack}><ArrowLeft size={16}/>{backLabel}</button><span>{data?.category??'Чай'}</span></div>
 <div className="product-first-screen"><div className="product-photo"><ProductGallery key={product.sku} product={product}/></div><div className="product-intro"><small>{data?.category??'Чай'} <span> / {product.sku}</span></small><h1>{displayName(product)}</h1><p className="product-lead">{productShort(product)}</p><p className="product-preview-status">Інформаційна картка · продажі ще не відкриті</p><p className="style-context">Знайомство зі стилем чаю. Деталі конкретної партії ще уточнюємо.</p>{note&&<p className="product-note">{note}</p>}
 {data&&<dl className="product-highlights"><div><dt>Напрям</dt><dd>{data.category}</dd></div>{data.recipe&&!needsBrewingConfirmation(product)&&<><div><dt>Пробний старт</dt><dd>{data.recipe.grams??'—'} г / {data.recipe.waterMl??'—'} мл</dd></div><div><dt>Вода для старту</dt><dd>{data.recipe.temperatureC??'—'} °C</dd></div></>}</dl>}
 <div className="product-main-actions"><button className="primary" onClick={onAsk}>Запитати YUN <ArrowUpRight size={19}/></button><button aria-pressed={saved} onClick={onSave}>{saved?<Check size={18}/>:<Plus size={18}/>} {saved?'У моїй добірці':'Зберегти чай'}</button></div><p className="preview-note">Ціну, фасування й доступність опублікуємо перед відкриттям замовлень. «Пробний старт» вище — порада для заварювання.</p></div></div>
 {data&&<CatalogueContent data={data}/>}
 {related.length>0&&<section className="related-teas"><div><small>ПРОДОВЖИТИ ЗНАЙОМСТВО</small><h2>Спробуй також</h2></div><div className="related-grid">{related.map(p=><article key={p.sku}><button onClick={()=>onOpen(p)}><ProductImage product={p}/><small>{p.contentV2?.category} · {p.sku}</small><h3>{displayName(p)}</h3><p>{relatedTeaReason(product,p)}</p><span>Дізнатися більше <ArrowUpRight size={17}/></span></button></article>)}</div></section>}
 </section>;
}
