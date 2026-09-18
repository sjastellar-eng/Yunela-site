import { describe, expect, it, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
import { Worker } from 'node:worker_threads';
import { openDatabase } from '../../database/client';
import { applyMigrations } from '../../database/migrate';
import { SqliteFulfillmentMutationRepository } from './sqliteDomainRepository';
import { FulfillmentApplicationService } from './service';
import type { AnalyticsEventName } from '../../contracts/analytics';

const databases: Array<ReturnType<typeof openDatabase>> = [];

function fixture(filename = ':memory:') {
  const db = openDatabase(filename);
  applyMigrations(db);
  databases.push(db);
  const customerId=randomUUID(), orderId=randomUUID(), purchaseId=randomUUID(), attemptId=randomUUID(), itemId=randomUUID(), teaId=randomUUID(), lotId=randomUUID(), now=new Date().toISOString();
  db.prepare('INSERT INTO customers (id,email,created_at) VALUES (?,?,?)').run(customerId, customerId+'@test.local', now);
  db.prepare('INSERT INTO tea_families (id,name) VALUES (?,?)').run('family-'+teaId, 'F5 Family');
  db.prepare('INSERT INTO teas (id,slug,name,family_id,sensory_json,discovery_distance,price_amount,price_currency,pack_size_grams,supply_status,provenance_confidence,publishing_state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(teaId,'f5-tea','F5 Tea','family-'+teaId,'{}',10,100,'UAH',10,'available','verified','published',now,now);
  db.prepare('INSERT INTO tea_lots (id,tea_id,lot_code,inventory_quantity,supply_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(lotId,teaId,'F5-LOT',10,'available',now,now);
  const shipping={recipientName:'F5 Test',addressLine1:'1 Main',city:'Dnipro',postalCode:'49000',countryCode:'UA'};
  db.prepare('INSERT INTO orders (id,customer_id,status,currency,subtotal_amount,discount_amount,shipping_amount,total_amount,shipping_snapshot_json,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(orderId,customerId,'confirmed','UAH',100,0,0,0,JSON.stringify(shipping),randomUUID(),now,now);
  db.prepare('INSERT INTO order_items (id,order_id,sku,tea_id,tea_name_snapshot,quantity,unit_price_amount,unit_price_currency,line_total_amount,recommendation_history_id,discovery_box_snapshot_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(itemId,orderId,'TEA-F5',teaId,'F5 Tea',1,100,'UAH',100,null,null);
  db.prepare('INSERT INTO payment_attempts (id,order_id,customer_id,provider,merchant_reference,requested_amount,requested_currency,state,idempotency_key,created_at,updated_at,confirmed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(attemptId,orderId,customerId,'MONO','ref-'+attemptId,100,'UAH','SUCCEEDED',randomUUID(),now,now,now);
  db.prepare('INSERT INTO purchases (id,order_id,customer_id,amount,currency,confirmed_at,payment_attempt_id,provider,provider_invoice_id,provider_reference) VALUES (?,?,?,?,?,?,?,?,?,?)').run(purchaseId,orderId,customerId,100,'UAH',now,attemptId,'MONO','inv-'+purchaseId,'pref-'+purchaseId);
  const events:Array<{event:AnalyticsEventName;payload:unknown}>=[];
  const analytics={track:(event:AnalyticsEventName,payload={})=>events.push({event,payload})};
  const repo=new SqliteFulfillmentMutationRepository(db);
  const service=new FulfillmentApplicationService(repo, analytics);
  return {db,repo,service,customerId,orderId,purchaseId,attemptId,itemId,teaId,lotId,events};
}
function packed(f:ReturnType<typeof fixture>) {
  const fulfillment=f.service.createFulfillmentFromPurchase(f.purchaseId);
  f.service.markReady(fulfillment.id,'SYSTEM','ready');
  f.service.startPacking(fulfillment.id,'YUNELA:f5','packing');
  f.service.markPacked(fulfillment.id,'YUNELA:f5','packed');
  return fulfillment;
}
function runConcurrentCreate(databaseFile:string, fulfillmentId:string) {
  const ready=new SharedArrayBuffer(4), go=new SharedArrayBuffer(4);
  const workers=[0,1].map(i=>new Worker(join(process.cwd(),'src/application/fulfillment/shipment-concurrency.worker.mjs'),{workerData:{databaseFile,fulfillmentId,operationKey:'concurrent-'+i,readyBuffer:ready,goBuffer:go}}));
  return new Promise<Array<{ok:boolean;shipmentId?:string;error?:string}>>((resolve,reject)=>{
    const results:Array<{ok:boolean;shipmentId?:string;error?:string}>=[]; let readyCount=0;
    for(const worker of workers){
      worker.on('message',m=>{if(m.ready){readyCount+=1;if(readyCount===2){Atomics.store(new Int32Array(go),0,1);Atomics.notify(new Int32Array(go),0,2);}}else{results.push(m);if(results.length===2)resolve(results);}});
      worker.on('error',reject);
    }
  });
}

afterEach(()=>{while(databases.length) databases.pop()?.close();});

describe('F5 Shipment application',()=>{
  it('creates Shipment only from PACKED Fulfillment',()=>{const f=fixture();const p=packed(f);const s=f.service.createShipment(p.id,'OPERATOR:f5','create');expect(s.status).toBe('CREATED');expect(f.service.getShipment(p.id).id).toBe(s.id);});
  it('rejects Shipment creation before PACKED',()=>{const f=fixture();const p=f.service.createFulfillmentFromPurchase(f.purchaseId);expect(()=>f.service.createShipment(p.id,'OPERATOR:f5','create')).toThrow(/after PACKED/);});
  it('prevents duplicate Shipment creation across two independent SQLite connections',async()=>{const databaseFile=join(tmpdir(),'yunela-f5-'+randomUUID()+'.db');const f=fixture(databaseFile);try{const p=packed(f);const results=await runConcurrentCreate(databaseFile,p.id);expect(results).toHaveLength(2);expect(results.every(r=>r.ok)).toBe(true);expect(new Set(results.map(r=>r.shipmentId)).size).toBe(1);expect(f.db.prepare('SELECT COUNT(*) c FROM shipments WHERE fulfillment_id=?').get(p.id)).toEqual({c:1});}finally{rmSync(databaseFile,{force:true});}});
  it('enforces exactly one Shipment per Fulfillment',()=>{const f=fixture();const p=packed(f);const a=f.service.createShipment(p.id,'OPERATOR:f5','create-1');const b=f.service.createShipment(p.id,'OPERATOR:f5','create-2');expect(b.id).toBe(a.id);expect(f.db.prepare('SELECT COUNT(*) c FROM shipments WHERE fulfillment_id=?').get(p.id)).toEqual({c:1});});
  it('is idempotent for repeated create with the same operation key',()=>{const f=fixture();const p=packed(f);const a=f.service.createShipment(p.id,'OPERATOR:f5','same');const b=f.service.createShipment(p.id,'OPERATOR:f5','same');expect(b.id).toBe(a.id);expect(f.events.filter(e=>e.event==='shipment_created')).toHaveLength(1);});
  it('supports manual carrier and tracking data at creation with validation',()=>{const f=fixture();const p=packed(f);const s=f.service.createShipment(p.id,'OPERATOR:f5','create',{carrier:'Nova Poshta',trackingNumber:'NP123',trackingUrl:'https://example.com/track/NP123'});expect(s.carrier).toBe('Nova Poshta');expect(s.trackingNumber).toBe('NP123');expect(s.trackingUrl).toContain('https://');});
  it('rejects invalid tracking URL',()=>{const f=fixture();const p=packed(f);expect(()=>f.service.createShipment(p.id,'OPERATOR:f5','create',{trackingUrl:'javascript:alert(1)'})).toThrow(/HTTP(S) URL/);});
  it('allows CREATED to SHIPPED and synchronizes Fulfillment',()=>{const f=fixture();const p=packed(f);f.service.createShipment(p.id,'OPERATOR:f5','create');const s=f.service.transitionShipment(p.id,'SHIPPED','OPERATOR:f5','ship');expect(s.status).toBe('SHIPPED');expect(f.service.getFulfillment(p.id).status).toBe('SHIPPED');expect(f.events.filter(e=>e.event==='order_shipped')).toHaveLength(1);});
  it('allows SHIPPED to DELIVERED and synchronizes Fulfillment',()=>{const f=fixture();const p=packed(f);f.service.createShipment(p.id,'OPERATOR:f5','create');f.service.transitionShipment(p.id,'SHIPPED','OPERATOR:f5','ship');const s=f.service.transitionShipment(p.id,'DELIVERED','OPERATOR:f5','deliver');expect(s.status).toBe('DELIVERED');expect(f.service.getFulfillment(p.id).status).toBe('DELIVERED');expect(f.events.filter(e=>e.event==='order_delivered')).toHaveLength(1);});
  it('rejects CREATED to DELIVERED',()=>{const f=fixture();const p=packed(f);f.service.createShipment(p.id,'OPERATOR:f5','create');expect(()=>f.service.transitionShipment(p.id,'DELIVERED','OPERATOR:f5','deliver')).toThrow(/cannot transition/);expect(f.service.getFulfillment(p.id).status).toBe('PACKED');});
  it('makes repeated same lifecycle transition idempotent',()=>{const f=fixture();const p=packed(f);f.service.createShipment(p.id,'OPERATOR:f5','create');const a=f.service.transitionShipment(p.id,'SHIPPED','OPERATOR:f5','ship-1');const b=f.service.transitionShipment(p.id,'SHIPPED','OPERATOR:f5','ship-2');expect(b.id).toBe(a.id);expect(f.events.filter(e=>e.event==='order_shipped')).toHaveLength(1);});
  it('supports FAILED exception from SHIPPED and emits delivery_failed',()=>{const f=fixture();const p=packed(f);f.service.createShipment(p.id,'OPERATOR:f5','create');f.service.transitionShipment(p.id,'SHIPPED','OPERATOR:f5','ship');f.service.transitionShipment(p.id,'FAILED','OPERATOR:f5','fail');expect(f.service.getShipment(p.id).status).toBe('FAILED');expect(f.service.getFulfillment(p.id).status).toBe('FAILED');expect(f.events.filter(e=>e.event==='delivery_failed')).toHaveLength(1);});
  it('supports LOST exception without mutating inventory',()=>{const f=fixture();const p=packed(f);f.service.createShipment(p.id,'OPERATOR:f5','create');f.service.transitionShipment(p.id,'SHIPPED','OPERATOR:f5','ship');f.service.transitionShipment(p.id,'LOST','OPERATOR:f5','lost');expect(f.service.getShipment(p.id).status).toBe('LOST');expect((f.db.prepare('SELECT inventory_quantity q FROM tea_lots WHERE id=?').get(f.lotId) as {q:number}).q).toBe(9);});
  it('supports RETURNED from DELIVERED and emits order_returned',()=>{const f=fixture();const p=packed(f);f.service.createShipment(p.id,'OPERATOR:f5','create');f.service.transitionShipment(p.id,'SHIPPED','OPERATOR:f5','ship');f.service.transitionShipment(p.id,'DELIVERED','OPERATOR:f5','deliver');f.service.transitionShipment(p.id,'RETURNED','OPERATOR:f5','return');expect(f.service.getShipment(p.id).status).toBe('RETURNED');expect(f.service.getFulfillment(p.id).status).toBe('RETURNED');expect(f.events.filter(e=>e.event==='order_returned')).toHaveLength(1);});
  it('supports operator-only tracking updates and preserves lifecycle',()=>{const f=fixture();const p=packed(f);f.service.createShipment(p.id,'OPERATOR:f5','create');const s=f.service.updateShipmentTracking(p.id,'OPERATOR:f5','track-1',{carrier:'DHL',trackingNumber:'DHL-1'});expect(s.status).toBe('CREATED');expect(s.carrier).toBe('DHL');expect(s.trackingNumber).toBe('DHL-1');});
  it('rejects invalid tracking data',()=>{const f=fixture();const p=packed(f);f.service.createShipment(p.id,'OPERATOR:f5','create');expect(()=>f.service.updateShipmentTracking(p.id,'OPERATOR:f5','bad',{trackingUrl:'ftp://bad'})).toThrow(/HTTP(S) URL/);});
  it('makes duplicate tracking update idempotent',()=>{const f=fixture();const p=packed(f);f.service.createShipment(p.id,'OPERATOR:f5','create');const a=f.service.updateShipmentTracking(p.id,'OPERATOR:f5','track',{carrier:'UPS',trackingNumber:'1'});const b=f.service.updateShipmentTracking(p.id,'OPERATOR:f5','track',{carrier:'UPS',trackingNumber:'2'});expect(b.trackingNumber).toBe(a.trackingNumber);expect(f.db.prepare("SELECT COUNT(*) c FROM fulfillment_events WHERE event_type='SHIPMENT_TRACKING_UPDATED'").get()).toEqual({c:1});});
  it('rejects non-YUNELA actors from Shipment mutation',()=>{const f=fixture();const p=packed(f);expect(()=>f.service.createShipment(p.id,'SUPPLIER:f5','create')).toThrow();expect(()=>f.service.createShipment(p.id,'CUSTOMER:f5','create')).toThrow();});
  it('emits analytics only after successful commit',()=>{const f=fixture();const p=packed(f);f.service.createShipment(p.id,'OPERATOR:f5','create');expect(f.events.map(e=>e.event)).toEqual(['shipment_created']);f.service.transitionShipment(p.id,'SHIPPED','OPERATOR:f5','ship');expect(f.events.map(e=>e.event)).toEqual(['shipment_created','order_shipped']);});
  it('emits no analytics when transition transaction rolls back',()=>{const f=fixture();const p=packed(f);f.service.createShipment(p.id,'OPERATOR:f5','create');const before=f.events.length;const original=f.repo.appendFulfillmentEvent.bind(f.repo);f.repo.appendFulfillmentEvent=(event)=>{if(event.eventType==='SHIPMENT:CREATED->SHIPPED') throw new Error('forced rollback');return original(event);};expect(()=>f.service.transitionShipment(p.id,'SHIPPED','OPERATOR:f5','rollback')).toThrow(/forced rollback/);expect(f.service.getShipment(p.id).status).toBe('CREATED');expect(f.service.getFulfillment(p.id).status).toBe('PACKED');expect(f.events.length).toBe(before);});
  it('does not mutate Order, Purchase or PaymentAttempt during shipment lifecycle',()=>{const f=fixture();const p=packed(f);const beforeOrder=f.db.prepare('SELECT * FROM orders WHERE id=?').get(f.orderId);const beforePurchase=f.db.prepare('SELECT * FROM purchases WHERE id=?').get(f.purchaseId);const beforeAttempt=f.db.prepare('SELECT * FROM payment_attempts WHERE id=?').get(f.attemptId);f.service.createShipment(p.id,'OPERATOR:f5','create');f.service.transitionShipment(p.id,'SHIPPED','OPERATOR:f5','ship');f.service.transitionShipment(p.id,'DELIVERED','OPERATOR:f5','deliver');expect(f.db.prepare('SELECT * FROM orders WHERE id=?').get(f.orderId)).toEqual(beforeOrder);expect(f.db.prepare('SELECT * FROM purchases WHERE id=?').get(f.purchaseId)).toEqual(beforePurchase);expect(f.db.prepare('SELECT * FROM payment_attempts WHERE id=?').get(f.attemptId)).toEqual(beforeAttempt);});
  it('does not mutate Discovery Box snapshot',()=>{const f=fixture();const snapshot=JSON.stringify({discoveryBoxId:'box',algorithmVersion:'v1',selectionVersion:'v1',items:[1,2,3,4,5,6].map((position)=>({teaId:f.teaId,teaName:'F5 Tea',classification:position<=3?'MATCH':position<=5?'STRETCH':'WILDCARD',position,score:90-position,reasons:['test']}))});f.db.prepare('UPDATE order_items SET discovery_box_snapshot_json=? WHERE id=?').run(snapshot,f.itemId);const p=packed(f);f.service.createShipment(p.id,'OPERATOR:f5','create');f.service.transitionShipment(p.id,'SHIPPED','OPERATOR:f5','ship');expect((f.db.prepare('SELECT discovery_box_snapshot_json v FROM order_items WHERE id=?').get(f.itemId) as {v:string}).v).toBe(snapshot);});
  it('preserves F4 physical inventory invariant after PACKED and Shipment lifecycle',()=>{const f=fixture();const p=packed(f);expect((f.db.prepare('SELECT inventory_quantity q FROM tea_lots WHERE id=?').get(f.lotId) as {q:number}).q).toBe(9);f.service.createShipment(p.id,'OPERATOR:f5','create');f.service.transitionShipment(p.id,'SHIPPED','OPERATOR:f5','ship');f.service.transitionShipment(p.id,'DELIVERED','OPERATOR:f5','deliver');expect((f.db.prepare('SELECT inventory_quantity q FROM tea_lots WHERE id=?').get(f.lotId) as {q:number}).q).toBe(9);});
  it('prevents a stale CREATED Shipment transition after concurrent state is already SHIPPED',()=>{const f=fixture();const p=packed(f);f.service.createShipment(p.id,'OPERATOR:f5','create');f.service.transitionShipment(p.id,'SHIPPED','OPERATOR:f5','ship');expect(()=>f.service.transitionShipment(p.id,'DELIVERED','OPERATOR:f5','deliver')).not.toThrow();expect(f.service.getShipment(p.id).status).toBe('DELIVERED');});
  it('returns NOT_FOUND for missing Shipment',()=>{const f=fixture();const p=f.service.createFulfillmentFromPurchase(f.purchaseId);expect(()=>f.service.getShipment(p.id)).toThrow(/Shipment was not created/);});
  it('keeps exactly one Shipment after two independent application calls',()=>{const f=fixture();const p=packed(f);const first=new FulfillmentApplicationService(f.repo);const second=new FulfillmentApplicationService(f.repo);const a=first.createShipment(p.id,'OPERATOR:a','a');const b=second.createShipment(p.id,'OPERATOR:b','b');expect(a.id).toBe(b.id);expect(f.db.prepare('SELECT COUNT(*) c FROM shipments WHERE fulfillment_id=?').get(p.id)).toEqual({c:1});});
  it('records shipment-created analytics once even when create is retried',()=>{const f=fixture();const p=packed(f);f.service.createShipment(p.id,'OPERATOR:f5','a');f.service.createShipment(p.id,'OPERATOR:f5','b');expect(f.events.filter(e=>e.event==='shipment_created')).toHaveLength(1);});
  it('keeps Shipment and Fulfillment terminal states synchronized',()=>{const f=fixture();const p=packed(f);f.service.createShipment(p.id,'OPERATOR:f5','create');f.service.transitionShipment(p.id,'SHIPPED','OPERATOR:f5','ship');f.service.transitionShipment(p.id,'DELIVERED','OPERATOR:f5','deliver');expect(f.service.getShipment(p.id).status).toBe('DELIVERED');expect(f.service.getFulfillment(p.id).status).toBe('DELIVERED');});
});
