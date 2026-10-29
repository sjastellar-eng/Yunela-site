import {afterEach,expect,it} from 'vitest';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {openDatabase} from '../database/client';
import {applyMigrations} from '../database/migrate';
import {createStoreServer} from './store-server';
import {importCatalog,installPolicy,syntheticCommercial} from '../application/commercialCatalog';
import {DEVELOPMENT_POLICY} from '../application/flexiblePricing';
const directory=mkdtempSync(join(tmpdir(),'yunela-task16-'));
afterEach(()=>rmSync(directory,{recursive:true,force:true}));
it('rehearses TEST-order evidence across local restart without dumping personal data',async()=>{
  const file=join(directory,'orders.sqlite'),db=openDatabase(file);applyMigrations(db);installPolicy(db,DEVELOPMENT_POLICY);importCatalog(db,[syntheticCommercial],false,'TEST');
  const app=createStoreServer({db,secret:'test16-secret-for-local-rehearsal-only',allowTestFixtures:true,syntheticOnly:true});
  await new Promise<void>(r=>app.server.listen(0,'127.0.0.1',r));const a=app.server.address();if(!a||typeof a==='string')throw Error('port');const base=`http://127.0.0.1:${a.port}/api/store`;
  let token='';
  const call=async(path:string,data:unknown)=>{const r=await fetch(base+path,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(data)});expect(r.ok).toBe(true);return r.json();};
  const evidence=(id:string)=>spawnSync(process.execPath,[resolve('scripts/staging-storage-evidence.mjs'),id],{encoding:'utf8',env:{...process.env,YUNELA_DB_FILE:file}});
  let orderId:string;
  let before:Record<string,unknown>;
  try {
    token=(await call('/session',{})).token;
    await call('/cart/items',{sku:'TEST-WEIGHT',format:'WEIGHT',weightGrams:100,quantity:1});
    const q=await call('/quote',{});
    const order=await call('/orders',{quoteId:q.id,idempotencyKey:'TEST16',shipping:{recipientName:'TEST TASK16 BUYER',phone:'+380000000000',city:'TEST CITY',addressLine1:'TEST ONLY',postalCode:'00000'}});
    orderId=order.order.id;
    const result=evidence(orderId);expect(result.status,result.stderr).toBe(0);before=JSON.parse(result.stdout);
    expect(before).toMatchObject({testOnly:true,orderId,sqliteIntegrity:'ok',orderCount:1});
    expect(result.stdout).not.toContain('+380000000000');expect(result.stdout).not.toContain('TEST TASK16 BUYER');
  } finally {await new Promise<void>(r=>app.server.close(()=>r()));db.close();}
  const reopened=openDatabase(file);
  try {
    applyMigrations(reopened);
    const result=evidence(orderId!);expect(result.status,result.stderr).toBe(0);expect(JSON.parse(result.stdout)).toEqual(before!);
    reopened.prepare('UPDATE orders SET shipping_snapshot_json=? WHERE id=?').run(JSON.stringify({recipientName:'private real name'}),orderId!);
    const denied=evidence(orderId!);expect(denied.status).not.toBe(0);expect(denied.stdout).toBe('');expect(denied.stderr).not.toContain('private real name');
  } finally {reopened.close();}
});
