import {readProfile,type YunaProfile} from '../yuna/discovery';
/** Server-only provider port. Implementations keep credentials in server env, never VITE_*. */
export interface YunaIntentProvider {parseIntent(input:{text:string;profile:YunaProfile;signal:AbortSignal}):Promise<unknown>}
export function validateYunaInput(value:unknown):{text:string;profile:YunaProfile}{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('INVALID_YUNA_INPUT');
 const b=value as Record<string,unknown>;const profile=readProfile(JSON.stringify(b.profile));
 if(Object.keys(b).some(k=>!['text','profile'].includes(k))||typeof b.text!=='string'||!b.text.trim()||b.text.length>600||!profile)throw Error('INVALID_YUNA_INPUT');
 return{text:b.text.trim(),profile};
}
export async function requestYunaIntent(provider:YunaIntentProvider,input:{text:string;profile:YunaProfile},timeoutMs=8000){
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 try{const raw=await Promise.race([provider.parseIntent({...input,signal:controller.signal}),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('YUNA_TIMEOUT'));},timeoutMs);})]);
 // Model may return only known preference enums. It cannot create SKU, prices, claims or tool calls.
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).some(k=>!['version','family','taste','intensity','experience','avoidBitter'].includes(k)))throw Error('INVALID_YUNA_OUTPUT');
 const profile=readProfile(JSON.stringify(raw));if(!profile)throw Error('INVALID_YUNA_OUTPUT');return{mode:'AI_INTENT_ONLY',profile};
 }finally{if(timer)clearTimeout(timer);controller.abort();}
}
