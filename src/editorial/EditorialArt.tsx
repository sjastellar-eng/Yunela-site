type ArtKind='leaf'|'gaiwan'|'pour'|'gift';
/** Original schematic editorial graphics: categories/concepts, never a product photograph. */
export default function EditorialArt({kind,className=''}:{kind:ArtKind;className?:string}){
 return <svg className={'editorial-art '+className} viewBox="0 0 360 260" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
 {kind==='leaf'&&<><circle cx="180" cy="130" r="101" opacity=".18"/><path d="M102 219Q185 145 240 47M145 173Q90 154 105 102Q151 102 168 146M179 130Q157 77 193 54Q224 84 208 109M166 155Q225 158 260 109Q209 95 187 130M122 194Q91 201 71 166Q102 148 138 176"/><path d="M109 112l45 44M198 66l-5 51M245 115l-48 26" opacity=".4"/><circle cx="279" cy="188" r="5"/></>}
 {kind==='gaiwan'&&<><ellipse cx="180" cy="208" rx="113" ry="8" opacity=".18"/><path d="M76 117h208l-28 65q-9 17-33 17h-86q-24 0-33-17zM64 115q116-67 232 0M155 67h50M180 66V51M125 211h110"/><path d="M140 133q8 39 27 48" opacity=".3"/><path d="M86 70l-13-13M270 54l12-13"/></>}
 {kind==='pour'&&<><path d="M54 186h122l-13 40H70zM188 76l94 20-24 75-77-17zM282 98q48-7 38 22q-9 21-46 20M181 94l-43 31 37 16M188 71q48-17 100 22M235 62l12-12"/><path d="M144 136q-10 30-29 42M153 141q-8 21-13 31" strokeDasharray="4 8"/><circle cx="95" cy="77" r="28" opacity=".4"/><path d="M95 57v21l13 8M70 43l-7-9M120 44l6-9" opacity=".6"/></>}
 {kind==='gift'&&<><path d="M77 111h206v32H77zM91 144v88h178v-88M169 111v121M192 111v121M180 108q-103-20-68-58q33-27 68 58q37-87 69-58q31 38-69 58"/><path d="M43 159l-9-12M310 167l16-6M82 47l-9-14"/><circle cx="295" cy="47" r="5"/></>}
 </g></svg>;
}
export function ArticleCover({slug}:{slug:string}){const kind:ArtKind=slug==='first-tea'?'leaf':slug==='teaware-start'?'gaiwan':'pour';return <div className={'journal-cover cover-'+slug} aria-hidden="true"><span className="cover-index">{kind==='leaf'?'01':kind==='gaiwan'?'02':'03'} / YUNELA JOURNAL</span><EditorialArt kind={kind}/><span className="cover-word">{kind==='leaf'?'ЗНАЙОМСЯ':kind==='gaiwan'?'ЗАВАРЮЙ':'ВІДКРИВАЙ'}</span></div>;}
