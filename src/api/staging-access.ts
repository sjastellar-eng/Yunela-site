import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
export type StagingAccess = { password:string; origin:string; secret:string };
const cookieName='yunela_staging';
const digest=(value:string,secret:string)=>createHmac('sha256',secret).update(value).digest('hex');
function equal(a:string,b:string){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function createStagingGate(config:StagingAccess){
  const secure=new URL(config.origin).protocol==='https:', attempts=new Map<string,{count:number;until:number}>();
  const headers={'cache-control':'no-store','x-content-type-options':'nosniff','x-frame-options':'DENY','referrer-policy':'no-referrer','x-robots-tag':'noindex, nofollow'};
  return async(req:IncomingMessage,res:ServerResponse):Promise<boolean>=>{
    for(const [k,v]of Object.entries(headers))res.setHeader(k,v);
    const path=new URL(req.url??'/','http://localhost').pathname;
    const token=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1);
    const parts=token?.split('.')??[];
    const valid=parts.length===2&&Number(parts[0])>Date.now()&&equal(parts[1],digest(parts[0]+':'+digest(config.password,config.secret),config.secret));
    if(path==='/staging/login'&&req.method==='POST'){
      if(req.headers.origin!==config.origin){res.writeHead(403);res.end('Origin denied');return false;}
      const now=Date.now();for(const[k,v]of attempts)if(v.until<now)attempts.delete(k);
      const key=req.socket.remoteAddress??'local',bucket=attempts.get(key)??{count:0,until:now+60000};bucket.count++;attempts.set(key,bucket);
      if(bucket.count>10||attempts.size>1000){res.writeHead(429);res.end('Try later');return false;}
      let raw='';for await(const chunk of req){raw+=chunk.toString();if(raw.length>4096){res.writeHead(413);res.end();return false;}}
      let password:unknown;try{password=(JSON.parse(raw) as {password?:unknown}).password;}catch{/* invalid login */}
      if(typeof password!=='string'||!equal(digest(password,config.secret),digest(config.password,config.secret))){res.writeHead(401);res.end('Access denied');return false;}
      const expiry=String(now+12*60*60*1000),value=expiry+'.'+digest(expiry+':'+digest(config.password,config.secret),config.secret);
      res.setHeader('set-cookie',`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${secure?'; Secure':''}`);res.writeHead(204);res.end();return false;
    }
    if(valid)return true;
    if(path==='/'&&req.method==='GET'){
      res.setHeader('content-type','text/html; charset=utf-8');res.setHeader('content-security-policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'");
      res.writeHead(200);res.end(`<!doctype html><html lang="uk"><meta name="viewport" content="width=device-width, initial-scale=1"><title>YUNELA — staging</title><style>body{background:#f3efe6;color:#171714;font:18px Arial;margin:10vh auto;max-width:480px;padding:24px}input,button{font:inherit;padding:14px;box-sizing:border-box;width:100%;margin:10px 0}button{background:#68745a;color:white;border:0}</style><h1>YUNELA</h1><p>Закритий тестовий магазин. Реальні платежі й відправлення вимкнені.</p><form><label>Пароль стенда<input type="password" required autocomplete="current-password"></label><button>Відкрити тестовий магазин</button><p role="alert"></p></form><script>document.querySelector('form').onsubmit=async e=>{e.preventDefault();const r=await fetch('/staging/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password:document.querySelector('input').value})});if(r.ok)location.reload();else document.querySelector('[role=alert]').textContent=r.status===429?'Забагато спроб. Спробуй пізніше.':'Доступ не підтверджено.'}</script></html>`);return false;
    }
    res.writeHead(401,{'content-type':'application/json'});res.end(JSON.stringify({error:{message:'Staging access required'}}));return false;
  };
}
