// Read-only evidence for one already-created TEST order; never dump customer rows.
import Database from 'better-sqlite3';
import {createHash} from 'node:crypto';
const source=process.env.YUNELA_DB_FILE,orderId=process.argv[2];
if(!source||!orderId)throw new Error('Set YUNELA_DB_FILE and supply the existing TEST order id');
const db=new Database(source,{readonly:true,fileMustExist:true});
try {
  if(db.pragma('quick_check',{simple:true})!=='ok')throw new Error('SQLite integrity check failed');
  const row=db.prepare('SELECT * FROM orders WHERE id=?').get(orderId);
  if(!row)throw new Error('Requested TEST order is absent');
  // The orders schema stores the authoritative order payload in these JSON columns.
  const shipping=JSON.parse(row.shipping_snapshot_json);
  if(!/^(TEST|SYNTHETIC)\b/i.test(shipping.recipientName??''))throw new Error('Evidence is restricted to explicitly synthetic orders');
  const items=db.prepare('SELECT * FROM order_items WHERE order_id=? ORDER BY id').all(orderId);
  const commercial=db.prepare('SELECT quote_json FROM order_commercial_snapshots WHERE order_id=?').get(orderId);
  const snapshotHash=createHash('sha256').update(JSON.stringify({order:row,items,commercial})).digest('hex');
  const payment=db.prepare('SELECT state FROM payment_attempts WHERE order_id=? ORDER BY created_at DESC LIMIT 1').get(orderId);
  const task=db.prepare('SELECT status FROM partner_tasks WHERE order_id=?').get(orderId);
  console.log(JSON.stringify({testOnly:true,orderId,orderSnapshotSha256:snapshotHash,paymentState:payment?.state??'NOT_STARTED',taskStatus:task?.status??null,sqliteIntegrity:'ok',orderCount:db.prepare('SELECT count(*) n FROM orders').get().n,buildCommit:process.env.RENDER_GIT_COMMIT??null},null,2));
} finally { db.close(); }
