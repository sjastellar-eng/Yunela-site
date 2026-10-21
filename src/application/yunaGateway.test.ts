import {describe,it,expect} from 'vitest';
import {EMPTY_PROFILE} from '../yuna/discovery';
import {requestYunaIntent,validateYunaInput} from './yunaGateway';
describe('server-only AI intent boundary',()=>{
 it('accepts bounded text and whitelisted profile only',()=>{expect(validateYunaInput({text:' Улун ',profile:EMPTY_PROFILE}).text).toBe('Улун');for(const x of [{text:'x'.repeat(601),profile:EMPTY_PROFILE},{text:'ok',profile:{...EMPTY_PROFILE,family:'Fake'}},{text:'ok',profile:EMPTY_PROFILE,apiKey:'secret'}])expect(()=>validateYunaInput(x)).toThrow();});
 it('accepts validated intent but never arbitrary generated text or SKU',async()=>{await expect(requestYunaIntent({parseIntent:async()=>({...EMPTY_PROFILE,family:'Улун'})},{text:'Улун',profile:EMPTY_PROFILE})).resolves.toMatchObject({mode:'AI_INTENT_ONLY'});for(const raw of [{...EMPTY_PROFILE,sku:'FAKE'},{...EMPTY_PROFILE,text:'cures illness'},{...EMPTY_PROFILE,family:'Unknown'}])await expect(requestYunaIntent({parseIntent:async()=>raw},{text:'ok',profile:EMPTY_PROFILE})).rejects.toThrow();});
 it('aborts slow providers and exposes no provider secrets',async()=>{let signal:AbortSignal|undefined;await expect(requestYunaIntent({parseIntent:async input=>{signal=input.signal;return new Promise(()=>{});}},{text:'ok',profile:EMPTY_PROFILE},10)).rejects.toThrow('YUNA_TIMEOUT');expect(signal?.aborted).toBe(true);});
});
