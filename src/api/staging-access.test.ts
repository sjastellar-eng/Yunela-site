import { afterEach, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createStagingGate } from './staging-access';
let server:Server|undefined;
afterEach(async()=>{if(server)await new Promise<void>(r=>server!.close(()=>r()));server=undefined;});
async function start(origin='https://staging.example.test'){
 const gate=createStagingGate({origin,password:'private-staging-password',secret:'separate-test-secret-32-characters'});
 server=createServer((req,res)=>{gate(req,res).then(ok=>{if(ok){res.writeHead(200);res.end('protected');}}).catch(()=>{res.writeHead(500);res.end();});});
 await new Promise<void>(r=>server!.listen(0,'127.0.0.1',r));const addr=server.address();if(!addr||typeof addr==='string')throw Error('port');return `http://127.0.0.1:${addr.port}`;
}
describe('private staging access boundary',()=>{
 it('guards pages, static assets, APIs and health, renders password gate only at root',async()=>{const url=await start();const root=await fetch(url);expect(root.status).toBe(200);expect(await root.text()).toContain('Пароль стенда');for(const path of ['/health','/api/store/catalog','/assets/index.js','/catalog/photo.jpg'])expect((await fetch(url+path)).status).toBe(401);expect(root.headers.get('x-robots-tag')).toBe('noindex, nofollow');});
 it('rejects wrong passwords and cross-origin login and sets secure HTTP-only cookie',async()=>{const url=await start();const login=(origin:string,password:string)=>fetch(url+'/staging/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({password})});expect((await login('https://evil.invalid','private-staging-password')).status).toBe(403);expect((await login('https://staging.example.test','wrong')).status).toBe(401);const success=await login('https://staging.example.test','private-staging-password');expect(success.status).toBe(204);const cookie=success.headers.get('set-cookie')!;expect(cookie).toContain('HttpOnly');expect(cookie).toContain('SameSite=Strict');expect(cookie).toContain('; Secure');expect((await fetch(url+'/api/store/catalog',{headers:{cookie:cookie.split(';')[0]}})).status).toBe(200);expect((await fetch(url+'/health',{headers:{cookie:cookie.split(';')[0]+'tampered'}})).status).toBe(401);expect((await fetch(url+'/health',{headers:{cookie:'yunela_staging=0.forged'}})).status).toBe(401);});
 it('limits password guessing and does not disclose password or secret',async()=>{const url=await start();let result:Response|undefined;for(let i=0;i<11;i++)result=await fetch(url+'/staging/login',{method:'POST',headers:{origin:'https://staging.example.test','content-type':'application/json'},body:JSON.stringify({password:'wrong'})});expect(result!.status).toBe(429);const html=await(await fetch(url)).text();expect(html).not.toContain('private-staging-password');expect(html).not.toContain('separate-test-secret');});
});
