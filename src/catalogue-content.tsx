import type {CatalogContentV2} from './contracts/catalogContent';
const statusLabels:Record<string,string>={UNKNOWN:'Не встановлено',GENERAL_REFERENCE:'Довідка про стиль',EDITORIAL_PROPOSAL:'Редакційна порада',DECLARED_SUPPLIER:'Заявлено постачальником',OBSERVED_SOURCE:'Прочитано на джерелі',EDITORIAL_TRANSCRIPTION:'Редакційна транскрипція',EDITORIAL_TAXONOMY:'Редакційна класифікація',REFERENCE_EQUIVALENCE_NOT_LABEL:'Довідковий відповідник, не етикетка',PROVISIONAL_EQUIVALENCE:'Попередня відповідність'};
export default function CatalogueContent({data}:{data:CatalogContentV2}){
 return <section className="catalogue-content" aria-label="Інформація про чай">
  <p className="content-disclosure">Інформаційна демокартка. {data.content.scopeDisclosure||'Описи стилю не є дегустацією конкретної партії.'} Наявність і можливість продажу не підтверджені.</p>
  {data.image.kind==='EDITORIAL_ILLUSTRATION'&&<p>Редакційна ілюстрація — не фото конкретної партії.</p>}<h2>Про цей чай</h2><div className="content-paragraphs">{data.content.full.split(/\n\s*\n/).map((p,i)=><p key={i}>{p}</p>)}</div>
  <details><summary>Смаковий орієнтир — довідково</summary><h3>Аромат</h3><p>{data.content.aroma}</p><h3>Смак</h3><p>{data.content.taste}</p><h3>Післясмак</h3><p>{data.content.finish}</p><h3>Обробка</h3><p>{data.content.processing}</p></details>
  <h2>Як заварювати</h2><p>Редакційна стартова порада, не інструкція виробника для цієї партії.</p><p>{data.content.brewing}</p>
  {data.recipe&&data.recipe.grams!==null&&<dl className="brew-parameters">{[['Чай',data.recipe.grams,'г'],['Вода',data.recipe.waterMl,'мл'],['Температура',data.recipe.temperatureC,'°C'],['Перший настій',data.recipe.firstInfusionSeconds,'с']].map(([label,value,unit])=><div key={String(label)}><dt>{label}</dt><dd>{value===null?'Не встановлено':`${value} ${unit}`}</dd></div>)}</dl>}
  <h3>Як обирати</h3><p>{data.content.buyerProfile}</p>
  <details><summary>Ідентифікація та джерела</summary><dl><dt>Вихідний запис</dt><dd>{data.sourceSku}</dd><dt>Canonical ID — попередній</dt><dd>{data.canonicalTeaId}</dd><dt>Назва у джерелі</dt><dd>{data.originalSourceName}</dd><dt>Категорія</dt><dd>{data.category}</dd><dt>Китайська таксономія</dt><dd>{data.taxonomyFamily}</dd><dt>Китайський оригінал</dt><dd>{data.chineseNameOriginal??'Не встановлено'}</dd>{data.chineseNameReference&&<><dt>Довідковий китайський відповідник — не підтверджена етикетка</dt><dd>{data.chineseNameReference}</dd></>}</dl>
  {data.possibleDuplicateGroupIds.length>0&&<p>Невирішені зв’язки: {data.possibleDuplicateGroupIds.join(', ')}. Записи не об’єднані.</p>}
  <p>Джерела: {data.sourceIds.join(', ')}</p><ul>{data.sourceUrls.map(u=><li key={u}><a href={u} target="_blank" rel="noopener noreferrer">{u}</a></li>)}</ul>
  <dl>{Object.entries(data.evidence).map(([field,e])=><div key={field}><dt>{({nameUA:'Назва',category:'Категорія',aroma:'Аромат',taste:'Смак',finish:'Післясмак',brewing:'Заварювання',processing:'Обробка',buyerProfile:'Для кого',taxonomyFamily:'Таксономія',nameZHOriginal:'Китайський оригінал',nameZHReference:'Китайський відповідник'}as Record<string,string>)[field]??field}</dt><dd>{statusLabels[e.status]??'Попередні дані'} · {e.sourceIds.join(', ')||'Джерело не встановлено'}</dd></div>)}</dl>
  </details><p>AI-сомельє: сенсорні характеристики цієї партії не підтверджені. Персональне ранжування недоступне.</p>
 </section>;
}
