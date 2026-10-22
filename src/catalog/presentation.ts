import type {CatalogContentV2} from '../contracts/catalogContent';
export interface ContentProduct {sku:string;name:string;family:string;contentV2?:CatalogContentV2}
/** Presentation only: the source record and evidence remain unchanged. */
export function readerText(text:string):string{
 return text.replace(/^Довідка про стиль, не дегустація партії\.\s*/u,'')
 .replace(/за назвою з прайсу/giu,'під цією назвою').replace(/з прайсу/giu,'з каталогу').replace(/У прайсі/gu,'У каталозі')
 .replace(/смак зразка не оцінено/giu,'деталі смаку ще уточнюємо').replace(/цього SKU/gu,'цього чаю').replace(/цьому SKU/gu,'цьому чаю');
}
export function displayName(p:ContentProduct):string{return p.name.replace(/\s*\((?:скорочення постачальника|назву уточнити|тип обробки уточнити)\)/gu,'');}
export function productShort(p:ContentProduct):string{
 // For identified oolong styles use the existing Product Director buyer introduction, verbatim.
 // Ambiguous identity/composition keeps the original short description and its caveat.
 if(/^LIST-0(1[4-9]|2[0-4])$/.test(p.sku)&&!['LIST-016','LIST-020','LIST-021','LIST-023'].includes(p.sku)&&p.contentV2?.content.buyerProfile)return readerText(p.contentV2.content.buyerProfile.split(/(?<=[.!?])\s+/u)[0]);
 const text=p.contentV2?.content.short??'';return readerText(text.startsWith(p.name+'. ')?text.slice(p.name.length+2):text);
}
export function aboutParagraphs(data:CatalogContentV2):string[]{
 const paragraphs=data.content.full.split(/\n\s*\n/u);
 // Product V2 separates the internal source note, style introduction, buyer, taste and recipe.
 const body=paragraphs.filter((p,i)=>i>0&&!/^(Як обирати:|Смаковий орієнтир|Редакційний старт:)/u.test(p));
 return(body.length?body:[data.content.full]).map(readerText);
}
export function needsBrewingConfirmation(p:ContentProduct){return ['LIST-013','LIST-021'].includes(p.sku);}
export function identityNote(p:ContentProduct):string|null{
 if(p.sku==='LIST-013')return'Уточнюємо повну назву й готовність чаю до заварювання.';
 if(p.sku==='LIST-021')return'Склад ще уточнюємо. Перед вибором важливо перевірити інгредієнти.';
 if(p.sku==='LIST-016'||p.sku==='LIST-020')return'Повну назву ще уточнюємо.';
 if(p.sku==='LIST-023')return'ҐАБА позначає спосіб обробки. Чайну основу ще уточнюємо.';
 return p.contentV2?.contentStatus==='READY_IDENTITY_ONLY'?'Інформацію про цей чай ще доповнюємо.':null;
}
