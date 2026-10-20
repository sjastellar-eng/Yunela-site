import { createHash, randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { Cart } from '../contracts/commerce';
import { economics } from './weightedCart';
import { getPolicy,getCommercial } from './commercialCatalog';
import { ApplicationError } from './errors';
function fingerprint(db:Database.Database,cart:Cart){return createHash('sha256').update(JSON.stringify(cart.items.map(i=>({sku:i.sku,quantity:i.quantity,amount:i.unitPrice.amount,commercial:i.commercial,record:i.commercial?getCommercial(db,i.commercial.sourceSku)?.version:null,policy:i.commercial?getPolicy(db).version:null,catalog:db.prepare('SELECT updated_at,availability,confirmed FROM partner_catalog WHERE sku=?').get(i.sku)})))).digest('hex');}
export function createQuote(db:Database.Database,customerId:string,cart:Cart){
 if(!cart.items.length||cart.items.some(i=>i.unavailable))throw new ApplicationError('CONFLICT','Виправте кошик перед підтвердженням');
 const assessment=economics(db,cart);const q={id:randomUUID(),total:cart.total.amount,assessment,expiresAt:new Date(Date.now()+getPolicy(db).quoteMinutes*60000).toISOString()};
 db.prepare('INSERT INTO store_quotes VALUES(?,?,?,?,?)').run(q.id,customerId,fingerprint(db,cart),JSON.stringify({...q,items:cart.items}),q.expiresAt);return q;
}
export function acceptQuote(db:Database.Database,customerId:string,id:unknown,cart:Cart){
 const q=typeof id==='string'?db.prepare('SELECT * FROM store_quotes WHERE id=? AND customer_id=?').get(id,customerId) as {fingerprint:string;expires_at:string}|undefined:undefined;
 if(!q||q.expires_at<=new Date().toISOString()||q.fingerprint!==fingerprint(db,cart))throw new ApplicationError('CONFLICT','Ціна або склад кошика змінилися. Поверніться до кошика та підтвердьте нову суму.');
}
