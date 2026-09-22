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
  db.prepare('INSERT INTO tea_families (id,name) VALUES (?)').run('family-'+teaId, 'F5 Family');
  db.prepare('INSERT INTO teas (id,slug,name,family_id,sensory_json,discovery_distance,price_amount,price_currency,pack_size_grams,supply_status,provenance_confidence,publishing_state,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(teaId,'f5-tea','F5 Tea','family-'+teaId,'{}',10,100,'UAH',10,'available','verified','published',now,now);
  db.prepare('INSERT INTO tea_lots (id,tea_id,lot_code,inventory_quantity,supply_status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').run(lotId,teaId,'F5-LOT',10,'available',now,now);
  const shipping={recipientName:'F5 Test',addressLine1:'1 Main',city:'Dnipro',postalCode:'49000',countryCode:'UA'};
  db.prepare('INSERT INTO orders (id,customer_id,status,currency,subtotal_amount,discount_amount,shipping_amount,total_amount,shipping_snapshot_json,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(orderId,customerId,'confirmed','UAH',100,0,0,100,JSON.stringify(shipping),randomUUID(),now,now);
  db.prepare('INSERT INTO order_items (id,order_id,sku,tea_id,tea_name_snapshot,quantity,unit_price_amount,unit_price_currency,line_total_amount,recommendation_history_id,discovery_box_snapshot_json) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(itemId,orderId,'TEA-F5',teaId,'F5 Tea',1,100,'UAH',100,null,null);
  db.prepare('INSERT INTO payment_attempts (id,order_id,customer_id,provider,merchant_reference,requested_amount,requested_currency,state,idempotency_key,created_at,updated_at,confirmed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)').run(attemptId,orderId,customerId,'MONO','ref-'+attemptId,100,'UAH','SUCCEEDED',randomUUID(),now,now,now);
  db.prepare('INSERT INTO purchases (id,order_id,customer_id,amount,currency,confirmed_at,payment_attempt_id,provider,provider_invoice_id,provider_reference) VALUES (?,?,?,?,?,?,?,?,?,?)').run(purchaseId,orderId,customerId,100,'UAH',now,attemptId,'MONO','inv-'+purchaseId,'pref-'+purchaseId);
  const events:Array<{event:AnalyticsEventName;payload:unknown}>= [];
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
  const readyBuffer=new SharedArrayBuffer(4), goBuffer=new SharedArrayBuffer(4);
  const ready=new Int32Array(readyBuffer), go=new Int32Array(goBuffer);
  const workers=[0,1].map(i=>new Worker(join(process.cwd(),'src/application/fulfillment/shipment-concurrency.worker.mjs'),{workerData:{databaseFile,fulfillmentId,operationKey:'concurrent-'+i,mode:'create',readyBuffer,goBuffer}}));
  while (Atomics.load(ready,0)<2) Atomics.wait(ready,0,Atomics.load(ready,0));
  Atomics.store(go,0,1);
  Atomics.notify(go,0,2);
  return Promise.all(workers.map(worker=>new Promise<{ok:boolean;shipmentId?:string;error?:string}>((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);}))).finally(()=>workers.forEach(worker=>worker.terminate()));
}

function runConcurrentOperations(databaseFile:string, fulfillmentId:string, operations:[{mode:'transition'|'tracking';operationKey:string;to?:'DELIVERED'|'FAILED';input?:{carrier?:string;trackingNumber?:string;trackingUrl?:string}},{mode:'transition'|'tracking';operationKey:string;to?:'DELIVERED'|'FAILED';input?:{carrier?:string;trackingNumber?:string;trackingUrl?:string}}]) {
  const readyBuffer=new SharedArrayBuffer(4), goBuffer=new SharedArrayBuffer(4);
  const ready=new Int32Array(readyBuffer), go=new Int32Array(goBuffer);
  const workers=operations.map(operation=>new Worker(join(process.cwd(),'src/application/fulfillment/shipment-concurrency.worker.mjs'),{workerData:{databaseFile,fulfillmentId,...operation,readyBuffer,goBuffer}}));
  while (Atomics.load(ready,0)<2) Atomics.wait(ready,0,Atomics.load(ready,0));
  Atomics.store(go,0,1);
  Atomics.notify(go,0,2);
  return Promise.all(workers.map(worker=>new Promise<{ok:boolean;shipmentId?:string;status?:string;carrier?:string;trackingNumber?:string;trackingUrl?:string;error?:string}>((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);}))).finally(()=>workers.forEach(worker=>worker.terminate()));
}
afterEach(()=>{while(databases.length) databases.pop()?.close();});

// F5 validation trigger: preserve production semantics and execute CI on this branch.
describe('F5 Shipment application',()=>{