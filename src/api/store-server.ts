import {requestYunaIntent,validateYunaInput,type YunaIntentProvider} from '../application/yunaGateway';
import { handoff,partnerPayload,cancelBeforeHandoff,refundTest } from '../application/partnerWorkflow';
import { calculatePackage } from '../application/flexiblePricing';
import { changeWeighted,repriceWeighted,reserveWeighted,economics } from '../application/weightedCart';
import { importCatalog,getCommercial,allowed,installPolicy,getPolicy } from '../application/commercialCatalog';
import type { Policy } from '../application/flexiblePricing';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { createQuote, acceptQuote } from '../application/storeQuote';
import { createStagingGate, type StagingAccess } from './staging-access';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import type Database from 'better-sqlite3';
import { AuthenticationService } from '../application/auth';
import { CustomerService } from '../application/customer/service';
import { CartService, OrderService } from '../application/commerce/service';
import { SqliteCartRepository, SqliteOrderRepository, SqliteCommercialProductRepository } from '../application/sqliteCommerceRepositories';
import { SqliteCustomerRepository, SqliteDiscoveryBoxRepository, SqliteRecommendationHistoryRepository } from '../application/sqliteRepositories';
import { ApplicationError } from '../application/errors';
import { PartnerTeaRepository, assertPurchasable, offer, syncCommerceProduct, taskEvent } from '../application/partnerStore';
import { PaymentService } from '../application/payment/service';
import { SqlitePaymentAttemptRepository } from '../application/payment/sqliteRepository';
import { TestMonoAdapter } from '../application/payment/testMono';
import { applicationErrorToHttp } from './errors';
import type { ShippingDetails } from '../contracts/commerce';

type Options = { yunaProvider?:YunaIntentProvider; db: Database.Database; secret: string; staticDir?: string; allowTestFixtures?: boolean; stagingAccess?: StagingAccess; requireQuote?: boolean; requireCommercialData?:boolean; syntheticOnly?:boolean; allowLegacyFixedSku?:boolean };
const hash = (v: string) => createHash('sha256').update(v).digest('hex');
const fail = (message: string): never => { throw new ApplicationError('VALIDATION_ERROR',message); };
function string(body: Record<string, unknown>, key: string, max = 200): string {
  const value = body[key];
  if (typeof value !== 'string' || !value.trim() || value.length > max) return fail(`Некоректне поле ${key}`);
  return value.trim();
}
async function body(request: IncomingMessage, limit=65536): Promise<Record<string,unknown>> {
  if (!request.headers['content-type']?.startsWith('application/json')) return fail('Потрібен JSON');
  let length = 0; const chunks: Buffer[] = [];
  for await (const c of request) { length += c.length; if (length > limit) return fail('Завеликий запит'); chunks.push(Buffer.from(c)); }
  let value: unknown;
  try { value = JSON.parse(Buffer.concat(chunks).toString()); } catch { return fail('Некоректний JSON'); }
  if (typeof value !== 'object' || !value || Array.isArray(value)) return fail('Потрібен об’єкт');
  return value as Record<string,unknown>;
}
export function createStoreServer(options: Options) {
  const { db, secret } = options;
  function cartFor(id:string){const c=repriceWeighted(db,cartService.createCart(id));carts.save(c);return c;}
  const gate=options.stagingAccess ? createStagingGate(options.stagingAccess):undefined;
  const customers = new SqliteCustomerRepository(db), customerService = new CustomerService(customers);
  const auth = new AuthenticationService(db,customerService,secret);
  const products = new SqliteCommercialProductRepository(db), teas = new PartnerTeaRepository(db);
  const carts = new SqliteCartRepository(db), orders = new SqliteOrderRepository(db);
  const boxes = new SqliteDiscoveryBoxRepository(db), history = new SqliteRecommendationHistoryRepository(db);
  const analytics = { track: () => undefined };
  const cartService = new CartService(carts,products,teas,customers,boxes,history,analytics);
  const orderService = new OrderService(orders,carts,products,teas,boxes,customers,analytics);
  const attempts = new SqlitePaymentAttemptRepository(db), mono = new TestMonoAdapter(secret);
  const payments = new PaymentService(attempts,orders,customers,mono,analytics,'offline-test-webhook');
  const buckets = new Map<string,{count:number;until:number}>();
  function rateLimit(req: IncomingMessage) {
    const now=Date.now();
    for(const [key,v] of buckets) if(v.until<now)buckets.delete(key);
    const key=req.socket.remoteAddress ?? 'local';
    const b=buckets.get(key) ?? {count:0,until:now+60000};
    if(++b.count>30 || buckets.size>1000) throw new ApplicationError('CONFLICT','Забагато запитів, спробуйте через хвилину');
    buckets.set(key,b);
  }
  function customer(req: IncomingMessage): string {
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
    const row = token ? db.prepare('SELECT customer_id FROM store_sessions WHERE token_hash=? AND expires_at>?').get(hash(token),new Date().toISOString()) as {customer_id:string}|undefined : undefined;
    if (!row) throw new ApplicationError('AUTHENTICATION_REQUIRED','Сесію завершено. Оновіть сторінку.');
    return row.customer_id;
  }
  function operator(req: IncomingMessage): string {
    const actor = auth.authenticate(req.headers.authorization);
    if (actor.type !== 'OPERATOR') throw new ApplicationError('FORBIDDEN','Потрібен оператор');
    return actor.id;
  }
  function visible(sku: string) {
    const p = offer(db,sku);
    if(options.syntheticOnly && (sku!=='TEST-WEIGHT' || !p.test_fixture))throw new ApplicationError('PRODUCT_UNAVAILABLE','На стенді дозволено лише TEST-WEIGHT');
    if(p.test_fixture && !getCommercial(db,sku) && options.allowLegacyFixedSku!==true)throw new ApplicationError('PRODUCT_UNAVAILABLE','Legacy fixed-SKU fixture is disabled in weighted mode');
    if (p.test_fixture && !options.allowTestFixtures) throw new ApplicationError('PRODUCT_NOT_FOUND','Товар не знайдено');
    if(options.requireCommercialData!==false && !p.test_fixture && !getCommercial(db,sku)?.approvedForTest)throw new ApplicationError('PRODUCT_UNAVAILABLE','Потрібні підтверджені комерційні дані та маса');
    return p;
  }
  function orderView(id: string) {
    return { handoff:db.prepare('SELECT status,command_id,revision FROM partner_handoffs WHERE order_id=?').get(id)??null,refund:db.prepare('SELECT status,amount FROM test_refunds WHERE order_id=?').get(id)??null,order: orders.getById(id), task: db.prepare('SELECT status,branding_requested,branding_confirmed,tracking FROM partner_tasks WHERE order_id=?').get(id), payment: db.prepare('SELECT state FROM payment_attempts WHERE order_id=? ORDER BY created_at DESC LIMIT 1').get(id) ?? {state:'NOT_STARTED'} };
  }
  async function route(req: IncomingMessage, res: ServerResponse) {
    if(gate && !await gate(req,res))return;
    res.setHeader('x-frame-options','DENY');
    res.setHeader('referrer-policy','no-referrer');
    res.setHeader('content-security-policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    const url = new URL(req.url ?? '/','http://localhost'), path = url.pathname;
    const send = (data: unknown, status=200) => { res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data,(key,value)=>!path.startsWith('/api/store/operator/')&&['supplierInvoiceMinor','landedMinor','perPackMinor','supplierWholeMinor','assessment'].includes(key)?undefined:value)); };
    if (['POST','PATCH','DELETE'].includes(req.method ?? '') && req.headers.origin && req.headers.origin !== `http://${req.headers.host}` && req.headers.origin !== `https://${req.headers.host}` && req.headers.origin !== options.stagingAccess?.origin) throw new ApplicationError('FORBIDDEN','Cross-origin mutation denied');
    if(path==='/api/store/yuna/intent'&&req.method==='POST'){
      customer(req);rateLimit(req);
      if(!options.yunaProvider)return send({error:{code:'YUNA_NOT_CONFIGURED',message:'Генеративний AI не підключено. Скористайся деморежимом за правилами.'}},503);
      let input:ReturnType<typeof validateYunaInput>;
      try{input=validateYunaInput(await body(req,8192));}catch{return send({error:{code:'VALIDATION_ERROR',message:'Некоректний запит YUN'}},400);}
      try{return send(await requestYunaIntent(options.yunaProvider,input));}catch{return send({error:{code:'YUNA_UNAVAILABLE',message:'AI тимчасово недоступний. Доступний деморежим за правилами.'}},502);}
    }
    if (path === '/health' && req.method === 'GET') return send({status:'ok',paymentMode:'offline-test',partnerDispatch:'disabled'});
    if (path === '/api/store/catalog' && req.method === 'GET') {
      const rows = db.prepare('SELECT * FROM partner_catalog WHERE test_fixture=0 OR ?=1 ORDER BY sku').all(options.allowTestFixtures ? 1:0) as ReturnType<typeof offer>[];
      return send({mode:'offline-test',items:rows.filter(p=>!p.test_fixture||!!getCommercial(db,p.sku)||options.allowLegacyFixedSku===true).map(p=>({sku:p.sku,name:p.name,family:p.family,image:p.image_path,price:p.retail_amount,availability:options.syntheticOnly && p.sku!=='TEST-WEIGHT'?'REQUEST':p.availability,confirmed:Boolean(p.confirmed),stock:(()=>{const r=db.prepare('SELECT stock_grams,reserved_grams FROM commercial_records WHERE source_sku=?').get(p.sku) as {stock_grams:number|null;reserved_grams:number}|undefined;return r?r.stock_grams===null?null:Math.max(0,r.stock_grams-r.reserved_grams):p.stock===null?null:Math.max(0,p.stock-p.reserved);})(),testFixture:Boolean(p.test_fixture),commercial:(()=>{const r=getCommercial(db,p.sku);return r?{canonicalTeaId:r.canonicalTeaId,lot:r.lot,version:r.version,testSellable:allowed(r)&&(!options.syntheticOnly||p.sku==='TEST-WEIGHT'),wholeGrams:allowed(r)?r.curve!.wholeGrams:null,minGrams:getPolicy(db).minGrams,stepGrams:getPolicy(db).stepGrams}:null;})(),packaging:p.packaging,termsNote:p.terms_note}))});
    }
    if (path === '/api/store/session' && req.method === 'POST') {
      rateLimit(req);
      const c = customerService.createAnonymousCustomer(), token = randomBytes(32).toString('hex');
      db.prepare('INSERT INTO store_sessions(token_hash,customer_id,expires_at) VALUES(?,?,?)').run(hash(token),c.id,new Date(Date.now()+86400000).toISOString());
      return send({token},201);
    }
    if (path === '/api/store/operator/login' && req.method === 'POST') {
      rateLimit(req);
      const b = await body(req), result = auth.login(string(b,'email'),string(b,'password'));
      if (result.identity.type !== 'OPERATOR') throw new ApplicationError('FORBIDDEN','Потрібен оператор');
      return send({token:result.accessToken});
    }
    if (path.startsWith('/api/store/operator/')) {
      const actor = operator(req);
      if(path==='/api/store/operator/catalog/import' && req.method==='POST'){const b=await body(req,2000000);return send(importCatalog(db,b.items,b.dryRun!==false,actor));}
      if(path==='/api/store/operator/policies' && req.method==='POST'){const b=await body(req);installPolicy(db,b as Policy);return send({version:getPolicy(db).version,testOnly:true});}
      if (path === '/api/store/operator/orders' && req.method === 'GET') {
        return send({items:(db.prepare('SELECT id FROM orders ORDER BY created_at DESC LIMIT 100').all() as {id:string}[]).map(x=>orderView(x.id))});
      }
      if (path === '/api/store/operator/catalog' && req.method === 'GET') return send({items:db.prepare('SELECT * FROM partner_catalog ORDER BY sku').all()});
      const productMatch = path.match(/^\/api\/store\/operator\/catalog\/([^/]+)$/);
      if (productMatch && req.method === 'PATCH') {
        const sku = decodeURIComponent(productMatch[1]), p = offer(db,sku), b=await body(req);
        if(getCommercial(db,sku))throw new ApplicationError('CONFLICT','Вагові пропозиції оновлюються лише новою версією імпорту');
        const availability = string(b,'availability');
        if (!['IN_STOCK','PREORDER','REQUEST','UNAVAILABLE'].includes(availability)) return fail('Некоректний статус');
        const price=b.retailAmount, stock=b.stock;
        if (price !== null && (!Number.isSafeInteger(price) || Number(price)<=0 || Number(price)>100000000)) return fail('Потрібна роздрібна ціна в копійках або null');
        if (stock !== null && (!Number.isSafeInteger(stock) || Number(stock)<p.reserved)) return fail('Некоректний залишок');
        if (b.confirmed !== true && availability === 'IN_STOCK') return fail('Потрібне підтвердження товару, ціни та залишку');
        if (availability === 'IN_STOCK' && (price===null || stock===null)) return fail('Потрібна ціна і залишок');
        const termsNote=typeof b.termsNote==='string' ? b.termsNote.trim().slice(0,500):null;
        if(availability==='PREORDER' && (b.confirmed!==true || price===null || !termsNote))return fail('Для товару під замовлення підтвердіть ціну й умови/строки');
        db.transaction(()=>{ db.prepare('UPDATE partner_catalog SET name=?,availability=?,retail_amount=?,stock=?,confirmed=?,packaging=?,terms_note=?,updated_at=? WHERE sku=?').run(string(b,'name'),availability,price,stock,b.confirmed===true ? 1:0,string(b,'packaging'),termsNote,new Date().toISOString(),sku);syncCommerceProduct(db,sku); })();
        return send({sku});
      }
      const internal=path.match(/^\/api\/store\/operator\/orders\/([^/]+)\/(handoff|cancel-test|refund-test)$/);
      if(internal&&req.method==='POST'){const o=orders.getById(decodeURIComponent(internal[1]));if(!o)throw new ApplicationError('ORDER_NOT_FOUND','Немає замовлення');const b=await body(req);if(internal[2]==='handoff')return send(handoff(db,o,b,actor));if(internal[2]==='refund-test')return send(refundTest(db,o,actor));cancelBeforeHandoff(db,o,string(b,'reason'),actor);return send(orderView(o.id));}
      const taskMatch=path.match(/^\/api\/store\/operator\/orders\/([^/]+)\/task$/);
      if (taskMatch && req.method === 'PATCH') {
        const id=decodeURIComponent(taskMatch[1]), b=await body(req), status=string(b,'status');
        if(orders.getItems(id).some(i=>i.commercial))throw new ApplicationError('CONFLICT','Використайте контрольований ваговий workflow');
        const transitions:Record<string,string[]>={NEW:['QUEUED_TEST','CANCELLED'],QUEUED_TEST:['PACKING','CANCELLED'],PACKING:['SHIPPED','CANCELLED'],SHIPPED:['DELIVERED'],DELIVERED:[],CANCELLED:[]};
        db.transaction(()=>{
          const t=db.prepare('SELECT status FROM partner_tasks WHERE order_id=?').get(id) as {status:string}|undefined;
          if (!t) throw new ApplicationError('ORDER_NOT_FOUND','Замовлення не знайдено');
          if (t.status === status) return;
          if (!transitions[t.status]?.includes(status)) throw new ApplicationError('CONFLICT','Недопустимий перехід');
          if (status!=='CANCELLED' && orders.getById(id)?.status!=='confirmed') throw new ApplicationError('CONFLICT','Спочатку тестова оплата');
          const tracking=status==='SHIPPED' ? string(b,'tracking',200) : null;
          const items=orders.getItems(id);
          if (status==='CANCELLED' || status==='SHIPPED') for(const i of items) db.prepare(`UPDATE partner_catalog SET reserved=reserved-?,stock=stock-? WHERE sku=?`).run(i.quantity,status==='SHIPPED'?i.quantity:0,i.sku);
          db.prepare('UPDATE partner_tasks SET status=?,tracking=COALESCE(?,tracking),branding_confirmed=?,updated_at=? WHERE order_id=?').run(status,tracking,b.brandingConfirmed===true ? 1:0,new Date().toISOString(),id);
          taskEvent(db,id,actor,status);
        })();
        return send(orderView(id));
      }
      const exportMatch=path.match(/^\/api\/store\/operator\/orders\/([^/]+)\/export$/);
      if (exportMatch && req.method==='GET') {
        const id=decodeURIComponent(exportMatch[1]), o=orders.getById(id);
        if (!o) throw new ApplicationError('ORDER_NOT_FOUND','Замовлення не знайдено');
        if(o.items.some(i=>i.commercial))return send(partnerPayload(o));
        return send({simulationOnly:true,dispatchEnabled:false,orderId:id,shipping:o.shipping,items:o.items.map(x=>({sku:x.sku,quantity:x.quantity,name:x.teaName})),packaging:orderView(id).task});
      }
      throw new ApplicationError('NOT_FOUND','Операцію не знайдено');
    }
    if (path.startsWith('/api/store/')) {
      const id=customer(req);
      if(path==='/api/store/estimate' && req.method==='POST'){const b=await body(req),r=getCommercial(db,string(b,'sku'));if(!r||!allowed(r))throw new ApplicationError('PRODUCT_UNAVAILABLE','Дані не підтверджені');visible(r.sourceSku);if(b.format!=='WEIGHT'&&b.format!=='WHOLE')return fail('Invalid format');const grams=b.format==='WHOLE'?r.curve!.wholeGrams:Number(b.weightGrams);const priced=calculatePackage(r.curve!,getPolicy(db),b.format,grams);return send({retailMinor:priced.retailMinor,weightGrams:grams,format:b.format,priceVersion:r.version,policyVersion:getPolicy(db).version});}
      if(path==='/api/store/quote' && req.method==='POST'){const c=cartFor(id);for(const i of c.items)if(!i.commercial)visible(i.sku);return send(createQuote(db,id,c));}
      if (path==='/api/store/cart' && req.method==='GET') return send(cartFor(id));
      if (path==='/api/store/cart/items' && ['POST','PATCH','DELETE'].includes(req.method ?? '')) {
        const b=await body(req), sku=string(b,'sku'), c=cartFor(id);
        if(getCommercial(db,sku.split('::')[0])){visible(sku.split('::')[0]);return send(changeWeighted(db,c,b,req.method!,carts));}
        visible(sku);
        if (req.method==='DELETE') return send(cartService.removeItem(id,c.id,sku));
        const quantity=Number(b.quantity);
        assertPurchasable(db,sku,quantity+(req.method==='POST'?(c.items.find(x=>x.sku===sku)?.quantity??0):0));
        return send(req.method==='POST'?cartService.addItem(id,c.id,{sku,quantity}):cartService.updateItem(id,c.id,sku,quantity));
      }
      if (path==='/api/store/orders' && req.method==='POST') {
        const b=await body(req), key=string(b,'idempotencyKey',128);
        if (!b.shipping || typeof b.shipping!=='object' || Array.isArray(b.shipping)) return fail('Потрібна адреса');
        const s=b.shipping as Record<string,unknown>;
        const shipping:ShippingDetails={recipientName:string(s,'recipientName'),phone:string(s,'phone',30),city:string(s,'city'),addressLine1:string(s,'addressLine1'),postalCode:string(s,'postalCode',20),countryCode:'UA'};
        if (!/^[+\d\s()-]{7,30}$/.test(shipping.phone!)) return fail('Некоректний телефон');
        const o=db.transaction(()=>{
          const existing=orders.getByIdempotency(id,key);if(existing)return existing;
          const c=cartFor(id);
          if(options.requireQuote!==false)acceptQuote(db,id,b.quoteId,c);
          economics(db,c);
          for(const i of c.items)if(!i.commercial){visible(i.sku);assertPurchasable(db,i.sku,i.quantity);}
          reserveWeighted(db,c);
          const created=orderService.createOrder(id,{cartId:c.id,shipping,idempotencyKey:key});
          for(const i of created.items)if(!i.commercial) db.prepare('UPDATE partner_catalog SET reserved=reserved+? WHERE sku=?').run(i.quantity,i.sku);
          const now=new Date().toISOString();
          db.prepare('INSERT INTO order_commercial_snapshots VALUES(?,?)').run(created.id,JSON.stringify({quoteId:b.quoteId??null,assessment:economics(db,c),items:created.items}));
          db.prepare("INSERT INTO partner_tasks(order_id,status,branding_requested,created_at,updated_at) VALUES(?,'NEW',?,?,?)").run(created.id,b.brandingRequested===true ? 1:0,now,now);
          taskEvent(db,created.id,'CUSTOMER:'+id,'NEW');
          c.items=[];carts.save(c);
          return created;
        })();return send(orderView(o.id),201);
      }
      const orderMatch=path.match(/^\/api\/store\/orders\/([^/]+)$/);
      if (orderMatch && req.method==='GET') { const o=orderService.getOrder(id,decodeURIComponent(orderMatch[1]));return send(orderView(o.id)); }
      const payMatch=path.match(/^\/api\/store\/orders\/([^/]+)\/payment$/);
      if (payMatch && req.method==='POST') {
        const orderId=decodeURIComponent(payMatch[1]), b=await body(req),paymentKey=string(b,'idempotencyKey',128);
        if(orderService.getOrder(id,orderId).status!=='created')throw new ApplicationError('CONFLICT','Only CREATED orders can start payment');
        if ((orderView(orderId).task as {status?:string}|undefined)?.status==='CANCELLED') throw new ApplicationError('CONFLICT','Замовлення скасовано');
        const active=db.prepare("SELECT id FROM payment_attempts WHERE order_id=? AND customer_id=? AND state IN ('CREATED','INITIATED','REQUIRES_ACTION') ORDER BY created_at DESC LIMIT 1").get(orderId,id) as {id:string}|undefined;
        return send(active?payments.getPaymentAttempt(id,active.id):await payments.createPaymentAttempt(id,orderId,paymentKey),201);
      }
      const resultMatch=path.match(/^\/api\/store\/payments\/([^/]+)\/test-result$/);
      if(resultMatch && req.method==='POST') {
        const attempt=payments.getPaymentAttempt(id,decodeURIComponent(resultMatch[1])), b=await body(req);
        if ((orderView(attempt.orderId).task as {status?:string}|undefined)?.status==='CANCELLED') throw new ApplicationError('CONFLICT','Замовлення скасовано');
        if(!['success','failure'].includes(String(b.result)))return fail('Некоректний результат');
        const raw=Buffer.from(JSON.stringify({invoiceId:attempt.providerInvoiceId,reference:attempt.merchantReference,amount:attempt.requestedAmount.amount,ccy:980,status:b.result,modifiedDate:new Date().toISOString()}));
        await payments.handleMonoWebhook(raw,mono.sign(raw));return send(orderView(attempt.orderId));
      }
      throw new ApplicationError('NOT_FOUND','Операцію не знайдено');
    }
    if(req.method!=='GET')throw new ApplicationError('NOT_FOUND','Сторінку не знайдено');
    if(options.staticDir) {
      const root=resolve(options.staticDir), file=resolve(root,'.'+decodeURIComponent(path==='/'?'/index.html':path));
      if(file!==root && !file.startsWith(root+sep))throw new ApplicationError('FORBIDDEN','Невірний шлях');
      if(existsSync(file) && extname(file)) {
        const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8'};
        res.writeHead(200,{'content-type':types[extname(file)]??'application/octet-stream','x-content-type-options':'nosniff'});res.end(readFileSync(file));return;
      }
    }
    throw new ApplicationError('NOT_FOUND','Сторінку не знайдено');
  }
  const server=createServer((req,res)=>{route(req,res).catch(e=>{ const mapped=applicationErrorToHttp(e,randomUUID());if(!res.headersSent){res.writeHead(mapped.status,{'content-type':'application/json'});res.end(JSON.stringify(mapped.body));}else res.destroy(); });});
  return {server,auth};
}
