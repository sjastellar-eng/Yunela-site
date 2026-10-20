import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from '../database/client';
import { applyMigrations } from '../database/migrate';
import { createStoreServer } from './store-server';
import { seedPartnerOffer } from '../application/partnerStore';
const secret='isolated-test-secret-not-production-12345';
const shipping={recipientName:'Тестовий покупець',phone:'+380000000000',city:'Тестове місто',addressLine1:'Тестове відділення',postalCode:'00000'};
describe('V2 storefront HTTP / persistent SQLite / offline PaymentService',()=>{
  let directory:string, db:ReturnType<typeof openDatabase>, app:ReturnType<typeof createStoreServer>, base:string;
  async function start(requireQuote=true){db=openDatabase(join(directory,'test.sqlite'));applyMigrations(db);app=createStoreServer({db,secret,allowTestFixtures:true,allowLegacyFixedSku:true,requireCommercialData:false,requireQuote});await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const address=app.server.address();if(!address||typeof address==='string')throw new Error('port');base=`http://127.0.0.1:${address.port}/api/store`;}
  async function stop(){await new Promise<void>((r,j)=>app.server.close(e=>e?j(e):r()));db.close();}
  async function call(path:string,token?:string,method='GET',data?:unknown){if(path==='/orders' && data && typeof data==='object' && !('quoteId' in data)){const q=await fetch(base+'/quote',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:'{}'});data={...data,quoteId:(await q.json()).id};}const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:data===undefined?undefined:JSON.stringify(data)});return {status:r.status,body:await r.json()};}
  async function guest(){return (await call('/session',undefined,'POST',{})).body.token as string;}
  async function operator(){return (await call('/operator/login',undefined,'POST',{email:'operator@example.test',password:'operator-password-123'})).body.token as string;}
  async function checkout(token:string,key='order-key'){await call('/cart/items',token,'POST',{sku:'TEST',quantity:1,amount:1});return call('/orders',token,'POST',{shipping,idempotencyKey:key,amount:1,brandingRequested:true});}
  beforeEach(async()=>{directory=mkdtempSync(join(tmpdir(),'yunela-store-'));await start();app.auth.provisionActor('OPERATOR','operator@example.test','operator-password-123');seedPartnerOffer(db,{sku:'TEST',name:'Test fixture',test:true,price:10000,stock:2});seedPartnerOffer(db,{sku:'PENDING',name:'Unverified partner photo'});});
  afterEach(async()=>{await stop();rmSync(directory,{recursive:true,force:true});});
  it('catalogue has no 17 SKU cap and never exposes procurement costs',async()=>{
    for(let i=0;i<35;i++)seedPartnerOffer(db,{sku:'PHOTO-'+i,name:'Unverified '+i});
    const r=await call('/catalog');expect(r.status).toBe(200);expect(r.body.items).toHaveLength(37);expect(r.body.items.find((x:{sku:string})=>x.sku==='PENDING').price).toBeNull();expect(JSON.stringify(r.body)).not.toContain('procurement_amount');
  });
  it('completes catalogue → cart → checkout → test payment → operator → status',async()=>{
    const token=await guest(), op=await operator();const created=await checkout(token);expect(created.status).toBe(201);const id=created.body.order.id;
    expect(created.body.order.pricingSnapshot.total.amount).toBe(10000);expect(created.body.task.status).toBe('NEW');expect((await call('/cart',token)).body.items).toHaveLength(0);
    expect((await call('/operator/orders/'+id+'/task',op,'PATCH',{status:'QUEUED_TEST'})).status).toBe(409);
    const p=await call('/orders/'+id+'/payment',token,'POST',{idempotencyKey:'payment-key'});expect(p.status).toBe(201);expect(p.body.providerInvoiceId).toMatch(/^test-/);
    const success=await call('/payments/'+p.body.id+'/test-result',token,'POST',{result:'success'});expect(success.body.payment.state).toBe('SUCCEEDED');expect(success.body.order.status).toBe('confirmed');
    await call('/payments/'+p.body.id+'/test-result',token,'POST',{result:'success'});expect((db.prepare('SELECT COUNT(*) n FROM purchases').get() as {n:number}).n).toBe(1);
    for(const status of ['QUEUED_TEST','PACKING','SHIPPED','DELIVERED'])expect((await call('/operator/orders/'+id+'/task',op,'PATCH',{status,tracking:'TEST-TRACK',brandingConfirmed:true})).status).toBe(200);
    const exported=await call('/operator/orders/'+id+'/export',op);expect(exported.body.dispatchEnabled).toBe(false);expect(exported.body.items[0]).not.toHaveProperty('unitPrice');
    const view=await call('/orders/'+id,token);expect(view.body.task).toMatchObject({status:'DELIVERED',tracking:'TEST-TRACK',branding_confirmed:1});
    expect(db.prepare('SELECT stock,reserved FROM partner_catalog WHERE sku=?').get('TEST')).toEqual({stock:1,reserved:0});
  });
  it('persists cart, sessions, orders and payment across restart',async()=>{
    const token=await guest();const created=await checkout(token);await stop();await start();const r=await call('/orders/'+created.body.order.id,token);expect(r.status).toBe(200);expect(r.body.task.status).toBe('NEW');
    await call('/cart/items',token,'POST',{sku:'TEST',quantity:1});await stop();await start();expect((await call('/cart',token)).body.items[0].quantity).toBe(1);
  });
  it('denies unauthenticated operators, spoofed customer ids and foreign orders',async()=>{
    const a=await guest(), b=await guest();const created=await checkout(a);expect((await call('/orders/'+created.body.order.id,b)).status).toBe(403);
    expect((await call('/operator/orders')).status).toBe(401);expect((await call('/operator/orders',a)).status).toBe(401);
    const r=await fetch(base+'/cart',{headers:{'x-customer-id':created.body.order.customerId}});expect(r.status).toBe(401);
    expect((await call('/operator/catalog/TEST',undefined,'PATCH',{})).status).toBe(401);
  });
  it('rejects unconfirmed products, malformed checkout, missing stock and invalid transitions',async()=>{
    const token=await guest();expect((await call('/cart/items',token,'POST',{sku:'PENDING',quantity:1})).status).toBe(409);
    expect((await call('/orders',token,'POST',{idempotencyKey:'bad',shipping:{}})).status).toBe(400);
    expect((await call('/cart/items',token,'POST',{sku:'TEST',quantity:3})).status).toBe(409);
    const c=await checkout(token);const op=await operator();expect((await call('/operator/orders/'+c.body.order.id+'/task',op,'PATCH',{status:'DELIVERED'})).status).toBe(409);
  });
  it('idempotent checkout reserves once and concurrent customers cannot oversell',async()=>{
    db.prepare("UPDATE partner_catalog SET stock=1 WHERE sku='TEST'").run();const a=await guest(), b=await guest();
    for(const t of [a,b])expect((await call('/cart/items',t,'POST',{sku:'TEST',quantity:1})).status).toBe(200);
    const results=await Promise.all([call('/orders',a,'POST',{shipping,idempotencyKey:'a'}),call('/orders',b,'POST',{shipping,idempotencyKey:'b'})]);expect(results.map(x=>x.status).sort()).toEqual([201,409]);
    const winner=results[0].status===201?a:b,key=results[0].status===201?'a':'b';const retry=await call('/orders',winner,'POST',{shipping,idempotencyKey:key});expect(retry.status).toBe(201);
    expect(db.prepare("SELECT reserved FROM partner_catalog WHERE sku='TEST'").get()).toEqual({reserved:1});expect((db.prepare('SELECT COUNT(*) n FROM orders').get() as {n:number}).n).toBe(1);
  });
  it('handles declined payment and cancellation releases partner reservation once',async()=>{
    const token=await guest(), op=await operator(), c=await checkout(token), id=c.body.order.id;
    const p=await call('/orders/'+id+'/payment',token,'POST',{idempotencyKey:'decline'});expect((await call('/payments/'+p.body.id+'/test-result',token,'POST',{result:'failure'})).body.payment.state).toBe('DECLINED');
    for(let i=0;i<2;i++)expect((await call('/operator/orders/'+id+'/task',op,'PATCH',{status:'CANCELLED'})).status).toBe(200);
    expect(db.prepare("SELECT stock,reserved FROM partner_catalog WHERE sku='TEST'").get()).toEqual({stock:2,reserved:0});expect((await call('/orders/'+id+'/payment',token,'POST',{idempotencyKey:'later'})).status).toBe(409);
  });
  it('operator can explicitly confirm a candidate retail offer; prepaid quotes stay non-purchasable',async()=>{
    const op=await operator(), t=await guest();const data={name:'Confirmed test offer',retailAmount:25000,stock:3,availability:'IN_STOCK',confirmed:true,packaging:'Уточнене тестове пакування'};
    expect((await call('/operator/catalog/PENDING',op,'PATCH',data)).status).toBe(200);expect((await call('/cart/items',t,'POST',{sku:'PENDING',quantity:1})).status).toBe(200);
    expect((await call('/operator/catalog/PENDING',op,'PATCH',{...data,availability:'PREORDER'})).status).toBe(400);
    expect((await call('/operator/catalog/PENDING',op,'PATCH',{...data,availability:'PREORDER',termsNote:'Test-only confirmed terms'})).status).toBe(200);expect((await call('/cart/items',t,'POST',{sku:'PENDING',quantity:1})).status).toBe(409);
  });
  it('D01 permits reading and deleting a discontinued cart line',async()=>{
    const t=await guest();await call('/cart/items',t,'POST',{sku:'TEST',quantity:1});
    db.prepare("UPDATE partner_catalog SET availability='UNAVAILABLE' WHERE sku='TEST'").run();db.prepare("UPDATE commercial_products SET available=0 WHERE sku='TEST'").run();
    expect((await call('/cart',t)).status).toBe(200);expect((await call('/cart/items',t,'DELETE',{sku:'TEST'})).body.items).toHaveLength(0);
  });
  it('D02 rejects missing, foreign and stale quotes then accepts explicit fresh confirmation',async()=>{
    await stop();await start(true);const t=await guest(),other=await guest();await call('/cart/items',t,'POST',{sku:'TEST',quantity:1});
    const q=(await call('/quote',t,'POST',{})).body;expect((await fetch(base+'/orders',{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+t},body:JSON.stringify({idempotencyKey:'missing',shipping})})).status).toBe(409);
    expect((await call('/orders',other,'POST',{idempotencyKey:'foreign',shipping,quoteId:q.id})).status).toBe(409);
    db.prepare("UPDATE commercial_products SET price_amount=25000 WHERE sku='TEST'").run();
    expect((await call('/orders',t,'POST',{idempotencyKey:'stale',shipping,quoteId:q.id})).status).toBe(409);
    const fresh=(await call('/quote',t,'POST',{})).body;expect(fresh.total).toBe(25000);
    expect((await call('/orders',t,'POST',{idempotencyKey:'fresh',shipping,quoteId:fresh.id,amount:1})).body.order.pricingSnapshot.total.amount).toBe(25000);
    expect((await call('/orders',t,'POST',{idempotencyKey:'fresh',shipping,quoteId:fresh.id})).status).toBe(201);
  });

});
