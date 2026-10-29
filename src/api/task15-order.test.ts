import {afterEach,beforeEach,expect,it} from 'vitest';
import {openDatabase} from '../database/client';
import {applyMigrations} from '../database/migrate';
import {createStoreServer} from './store-server';
import {importCatalog,installPolicy,syntheticCommercial} from '../application/commercialCatalog';
import {DEVELOPMENT_POLICY} from '../application/flexiblePricing';
let db:ReturnType<typeof openDatabase>,app:ReturnType<typeof createStoreServer>,base:string,token:string;
const shipping={recipientName:'TEST BUYER',phone:'+380000000000',city:'TEST',addressLine1:'TEST ONLY',postalCode:'00000'};
async function call(path:string,method='GET',data?:unknown){const response=await fetch(base+path,{method,headers:{'content-type':'application/json',authorization:'Bearer '+token},body:data===undefined?undefined:JSON.stringify(data)});return {status:response.status,body:await response.json()};}
beforeEach(async()=>{
  db=openDatabase();applyMigrations(db);installPolicy(db,DEVELOPMENT_POLICY);
  importCatalog(db,[syntheticCommercial,{...syntheticCommercial,sourceSku:'TEST-SECOND',canonicalTeaId:'TEST-SECOND',name:'TEST SECOND PRODUCT'}],false,'TEST');
  app=createStoreServer({db,secret:'task15-isolated-test-secret-32-characters',allowTestFixtures:true});
  await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const a=app.server.address();if(!a||typeof a==='string')throw Error('port');base=`http://127.0.0.1:${a.port}/api/store`;
  token=(await call('/session','POST',{})).body.token;
});
afterEach(async()=>{await new Promise<void>(r=>app.server.close(()=>r()));db.close();});
const add=(sku:string)=>call('/cart/items','POST',{sku,format:'WEIGHT',weightGrams:100,quantity:1,price:1,total:1});
it('handles two distinct synthetic products, weight changes, removal and an empty cart',async()=>{
  await add('TEST-WEIGHT');const two=await add('TEST-SECOND');expect(two.body.items).toHaveLength(2);expect(two.body.total.amount).toBe(120000);
  const changed=await call('/cart/items','PATCH',{sku:'TEST-SECOND::WEIGHT',format:'WEIGHT',weightGrams:50,quantity:1,total:1});expect(changed.body.total.amount).toBe(95000);
  await call('/cart/items','DELETE',{sku:'TEST-SECOND::WEIGHT'});const empty=await call('/cart/items','DELETE',{sku:'TEST-WEIGHT::WEIGHT'});expect(empty.body.items).toHaveLength(0);expect(empty.body.total.amount).toBe(0);
  expect((await call('/quote','POST',{})).status).toBe(409);
});
it('rejects missing/invalid shipping and rolls back a server failure before a successful retry',async()=>{
  await add('TEST-WEIGHT');const quote=(await call('/quote','POST',{})).body;
  const body={shipping,quoteId:quote.id,idempotencyKey:'TEST-RETRY',amount:1,total:1};
  for(const s of [{},{...shipping,recipientName:''},{...shipping,phone:'bad'}])expect((await call('/orders','POST',{...body,shipping:s})).status).toBe(400);
  db.exec("CREATE TRIGGER task15_failure BEFORE INSERT ON orders BEGIN SELECT RAISE(ABORT, 'TEST server failure'); END;");
  expect((await call('/orders','POST',body)).status).toBe(500);
  expect((db.prepare('SELECT count(*) n FROM orders').get() as {n:number}).n).toBe(0);
  expect((db.prepare('SELECT sum(reserved_grams) n FROM commercial_records').get() as {n:number}).n).toBe(0);
  expect((await call('/cart')).body.items).toHaveLength(1);
  db.exec('DROP TRIGGER task15_failure');
  const retry=await call('/orders','POST',body);expect(retry.status).toBe(201);expect(retry.body.order.pricingSnapshot.total.amount).toBe(60000);
  const repeat=await call('/orders','POST',body);expect(repeat.body.order.id).toBe(retry.body.order.id);expect((await call('/orders/'+retry.body.order.id)).status).toBe(200);
});
