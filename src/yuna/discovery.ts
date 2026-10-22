import styleData from '../data/style-discovery.v1.json';
import {assessSommelierReadiness} from '../application/sommelierReadiness';
import type {CatalogContentV2} from '../contracts/catalogContent';
export interface DiscoveryProduct {sku:string;name:string;family:string;image:string|null;contentV2?:CatalogContentV2;testFixture:boolean}
export const FAMILY_OPTIONS=['Усі напрями','Пуер','Улун','Білий чай','Зелений чай','Червоний чай'] as const;
export const TASTE_OPTIONS=['Ще не знаю','М’який напрям','Свіжий напрям','Аромат і текстура'] as const;
export const INTENSITY_OPTIONS=['Не визначено','Легка','Середня','Виразна'] as const;
export const EXPERIENCE_OPTIONS=['Перше знайомство','Вже пробував / пробувала','Люблю досліджувати'] as const;
export interface YunaProfile {version:'yuna-v1';family:string;taste:string;intensity:string;experience:string;avoidBitter:boolean}
export const EMPTY_PROFILE:YunaProfile={version:'yuna-v1',family:FAMILY_OPTIONS[0],taste:TASTE_OPTIONS[0],intensity:INTENSITY_OPTIONS[0],experience:EXPERIENCE_OPTIONS[0],avoidBitter:false};
export function readProfile(raw:string|null):YunaProfile|null{
 try{if(!raw||raw.length>1500)return null;const p=JSON.parse(raw);if(p.version!=='yuna-v1'||!FAMILY_OPTIONS.includes(p.family)||!TASTE_OPTIONS.includes(p.taste)||!INTENSITY_OPTIONS.includes(p.intensity)||!EXPERIENCE_OPTIONS.includes(p.experience)||typeof p.avoidBitter!=='boolean')return null;return{version:'yuna-v1',family:p.family,taste:p.taste,intensity:p.intensity,experience:p.experience,avoidBitter:p.avoidBitter};}catch{return null;}
}
export function interpretMessage(text:string,profile:YunaProfile):{profile:YunaProfile;message:string}{
 const q=text.toLocaleLowerCase('uk-UA').slice(0,600),p={...profile};
 if(/ліку|леч|тиск|давлен|вагіт|беремен|медич|сон|кофеїн/.test(q))return{profile:p,message:'Я не визначаю лікувальні властивості чи безпечність чаю для здоров’я. Можу допомогти з вибором чайного напряму.'};
 if(/порів|сравн|відрізня|отлич/.test(q))return{profile:p,message:'Познач два чаї кнопкою «Порівняти» — зіставимо їхні описи та рецепти поруч.'};
 let understood=false;
 for(const [re,family]of [[/пуер|пуэр/,'Пуер'],[/улун/,'Улун'],[/білий|белый/,'Білий чай'],[/зелений|зелёный|зеленый/,'Зелений чай'],[/червоний|красный/,'Червоний чай']] as const)if(re.test(q)){p.family=family;understood=true;break;}
 if(/м’я|м'я|мяг|солод|слад/.test(q)){p.taste='М’який напрям';understood=true;}
 if(/свіж|свеж/.test(q)){p.taste='Свіжий напрям';understood=true;}
 if(/аромат|текстур/.test(q)){p.taste='Аромат і текстура';understood=true;}
 if(/не люблю гір|не люблю гор|без гір|без гор/.test(q)){p.avoidBitter=true;understood=true;}
 if(/перш|перв|новач/.test(q)){p.experience=EXPERIENCE_OPTIONS[0];understood=true;}
 if(/легк/.test(q)){p.intensity='Легка';understood=true;}else if(/насич|насыщ|виразн/.test(q)){p.intensity='Виразна';understood=true;}
 return{profile:p,message:understood?'Гаразд, покажу кілька чаїв цього напряму. Деталі смаку партії ще не підтверджено.':'Спробуй «Хочу улун» або «Не люблю гіркоту». Або натисни «Кілька запитань» — допоможу розібратися.'};
}
const styles=styleData.records as Record<string,{tags:string[];sourceIds:string[];scope:string;use:string}>;
export function discoverStyles(products:DiscoveryProduct[],p:YunaProfile,offset=0){
 const eligible=products.filter(x=>!x.testFixture&&x.contentV2?.sourceSku===x.sku&&x.contentV2.contentStatus==='READY_WITH_DISCLOSURE'&&styles[x.sku]?.scope==='GENERAL_STYLE_NOT_LOT'&&styles[x.sku]?.use==='EDITORIAL_DISCOVERY_ONLY'&&styles[x.sku].sourceIds.length>0&&styles[x.sku].sourceIds.every(id=>x.contentV2!.sourceIds.includes(id)));
 // Only an editorial browse order; never a taste score or a lot recommendation.
 let pool=eligible.filter(x=>p.family==='Усі напрями'||x.contentV2?.category===p.family);
 const wanted=p.taste==='М’який напрям'?['rounded_style_reference','white_tea_exploration']:p.taste==='Свіжий напрям'?['green_tea_exploration']:p.taste==='Аромат і текстура'?['yancha_exploration','texture','oolong_exploration']:[];
 if(wanted.length){const narrowed=pool.filter(x=>styles[x.sku].tags.some(t=>wanted.includes(t)));if(narrowed.length)pool=narrowed;}
 pool.sort((a,b)=>a.sku.localeCompare(b.sku));const start=pool.length?offset%pool.length:0;
 return{items:[...pool.slice(start),...pool.slice(0,start)].slice(0,3),total:pool.length,verifiedRecommendations:products.filter(x=>assessSommelierReadiness(x.contentV2).eligible).length,mode:'EDITORIAL_DISCOVERY_ONLY' as const};
}
export function compareProducts(a:DiscoveryProduct,b:DiscoveryProduct){return[a,b].map(p=>({sku:p.sku,name:p.name,category:p.contentV2?.category??'Не встановлено',taste:p.contentV2?.content.taste??'Не встановлено',brewing:p.contentV2?.content.brewing??'Не встановлено',scope:'Довідка про стиль. Партію не продегустовано.'}));}
