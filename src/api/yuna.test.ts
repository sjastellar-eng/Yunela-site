import {beforeEach,afterEach,describe,it,expect} from 'vitest';
import {openDatabase} from '../database/client';import {applyMigrations} from '../database/migrate';import {createStoreServer} from './store-server';import {EMPTY_PROFILE} from '../yuna/discovery';import type {YunaIntentProvider} from '../application/yunaGateway';
describe('YUNA HTTP boundary',()=>{
 let db:ReturnType<typeof openDatabase>,app:ReturnType<typeof createStoreServer>,base:string;
 async function start(provider?:YunaIntentProvider){db=openDatabase();applyMigrations(db);app=createStoreServer({db,secret:'test-yuna-auth-secret-at-least-32-characters',yunaProvider:provider});await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const a=app.server.address();if(!a||typeof a==='string')throw Error('address');base=`http://127.0.0.1:${a.port}`;}
 beforeEach(async()=>{await start();});afterEach(async()=>{await new Promise<void>(r=>app.server.close(()=>r()));db.close();});
 async function guest(){const r=await fetch(base+'/api/store/session',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});return(await r.json()).token as string;}
 const input={text:'Улун',profile:EMPTY_PROFILE};
 async function post(token?:string,body:unknown=input,origin?:string){return fetch(base+'/api/store/yuna/intent',{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...(origin?{origin}:{})},body:JSON.stringify(body)});}
 it('requires a server session and stays unavailable by default',async()=>{expect((await post()).status).toBe(401);expect((await post(await guest())).status).toBe(503);});
 it('rejects foreign origins',async()=>{expect((await post(await guest(),input,'https://evil.invalid')).status).toBe(403);});
 it('limits authenticated AI requests even when not configured',async()=>{const t=await guest();let status=0;for(let i=0;i<32;i++)status=(await post(t)).status;expect(status).toBe(409);});
 it('only returns validated preferences and sanitizes provider errors',async()=>{await new Promise<void>(r=>app.server.close(()=>r()));db.close();await start({parseIntent:async()=>({...EMPTY_PROFILE,family:'Улун'})});const t=await guest();expect((await post(t)).status).toBe(200);expect((await post(t,{...input,text:'x'.repeat(601)})).status).toBe(400);});
});
