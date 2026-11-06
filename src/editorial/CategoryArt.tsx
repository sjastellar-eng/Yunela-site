export type CategoryArtKind='teapot'|'gaiwan'|'cups'|'pitcher'|'tray'|'tipot'|'set'|'tools'|'knife'|'filter'|'chahe'|'textile'|'coaster'|'caddy'|'friend'|'scale'|'bottle'|'tasting'|'gift'|'travel';
/** Original YUNELA category drawings, not depictions of a particular sale item. */
export default function CategoryArt({kind,engraved=false}:{kind:CategoryArtKind;engraved?:boolean}){
 return <svg className={'category-art art-'+kind} viewBox="0 0 240 160" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
 {kind==='teapot'&&<><path d="M63 81q-5 57 55 57t52-57zM66 79q52-36 102 0M110 59h17v-9h-17zM170 85q48-20 36 12q-8 21-36 20M63 90L28 71l17 40 27 11M84 142h69"/><path d="M97 89q-6 23 2 33" opacity=".35"/></>}
 {kind==='gaiwan'&&<><path d="M48 73h144l-21 47q-5 13-23 13H92q-18 0-23-13zM40 72q80-44 160 0M105 40h30M120 39V28"/><ellipse cx="120" cy="141" rx="78" ry="7"/></>}
 {kind==='cups'&&<><path d="M22 60h88l-13 48q-4 10-16 10H52q-12 0-16-10zM144 77h69l-10 35q-3 10-14 10h-13q-11 0-14-10zM110 73q30-4 23 15q-4 11-27 11"/><ellipse cx="67" cy="130" rx="47" ry="6"/><ellipse cx="180" cy="135" rx="37" ry="5"/></>}
 {kind==='pitcher'&&<><path d="M88 38h62l24 93q-40 23-91 0L68 55zM153 58q57-6 45 35q-7 22-34 20M91 52q13 29 9 65"/><path d="M77 36q42-16 77 0"/></>}
 {kind==='tray'&&<><path d="M28 58l149-25 39 70-147 28zM28 58v18l41 72 147-28v-17M69 131v17"/><path d={engraved?'M77 83q17-38 36-14t44-12M87 105q18-39 37-15t43-14':'M56 64l113-20M65 77l112-21M74 91l112-21M83 105l112-21'} opacity=".65"/></>}
 {kind==='tipot'&&<><path d="M78 40h90v90q-45 20-90 0zM67 39h112M166 56q48-5 38 34q-5 21-36 20M94 45v53h58V45M95 107h57M114 25h24v13"/><path d="M97 119h53M100 83h46" opacity=".4"/></>}
 {kind==='set'&&<><path d="M30 129h182M58 50h92l-14 38H73zM53 49q52-27 103 0M99 25h14M64 98h34l-7 20H71zM119 98h34l-7 20h-20zM175 74h29l8 43h-43zM204 83q25 0 15 20h-10"/></>}
 {kind==='tools'&&<><path d="M65 44v90q32 15 64 0V44M57 43h80M80 43L68 17M96 43V14M113 43l11-25M159 28l11 99M170 127l17 10M185 30l-15 97M172 30l-11 10"/><ellipse cx="97" cy="44" rx="36" ry="7"/></>}
 {kind==='knife'&&<><path d="M48 117l61-57 17 17-61 57zM109 60l49-39 25 8-57 48M157 105l41-52M144 123l13-18 9 7-12 19z"/><path d="M64 111l12-11" opacity=".4"/></>}
 {kind==='filter'&&<><path d="M55 43h124l-39 68h-46zM142 63h61v13h-68M92 121h51"/><path d="M79 57h76M85 71h62M93 85h46M102 99h27" opacity=".45"/></>}
 {kind==='chahe'&&<><path d="M40 99q-2-35 137-58l23 47q-124 84-160 11zM42 96q50 27 154-11M92 78l18 8 14-20M121 90l15 4 17-21"/></>}
 {kind==='textile'&&<><path d="M40 44h143l22 87H59zM41 45l-8 78 26 8M68 53l19 71M83 53l19 71M168 54l18 70M45 123l-3 13M53 126l-2 13M64 132l-2 12M76 133l-2 12"/></>}
 {kind==='coaster'&&<><ellipse cx="115" cy="96" rx="76" ry="32"/><path d="M39 96v9q76 67 152 0v-9"/><ellipse cx="115" cy="95" rx="55" ry="21"/><path d="M175 40l18-13M184 49l21-4" opacity=".4"/></>}
 {kind==='caddy'&&<><path d="M68 43v85q48 28 96 0V43M64 35q52-26 104 0v13q-52 26-104 0z"/><path d="M94 78h44v35H94zM108 90h16" opacity=".4"/></>}
 {kind==='friend'&&<><path d="M76 80q-13-53 16-48l17 23h24l20-24q30 2 11 54q26 58-44 58T76 80zM90 92h3M146 92h3M112 107l7 6 7-6M103 126q16 7 31 0"/><path d="M51 108l-14-6M185 112l15-3" opacity=".4"/></>}
 {kind==='scale'&&<><rect x="53" y="75" width="138" height="65" rx="12"/><ellipse cx="122" cy="66" rx="66" ry="17"/><path d="M56 66v14M188 66v14M81 104h51v21H81z"/><circle cx="162" cy="113" r="7"/></>}
 {kind==='bottle'&&<><path d="M94 35h47v15q12 8 12 20v63q-35 20-70 0V70q0-12 11-20zM93 34V21h49v13M86 89h65M86 113h65"/><path d="M105 59v20" opacity=".4"/></>}
 {kind==='tasting'&&<><path d="M36 47h45v83H36zM98 34h45v96H98zM160 47h45v83h-45zM47 60h23M109 47h23M171 60h23M48 108h21M110 108h21M172 108h21"/></>}
 {kind==='gift'&&<><path d="M51 60h140v25H51zM61 85v55h120V85M111 60v80M131 60v80M120 59Q48 43 75 21q24-17 45 38q21-56 45-38q27 22-45 38"/></>}
 {kind==='travel'&&<><rect x="48" y="52" width="145" height="86" rx="14"/><path d="M91 51V32h59v19M49 88h143M109 81h23v15h-23zM67 115h20"/></>}
 </g></svg>;
}
