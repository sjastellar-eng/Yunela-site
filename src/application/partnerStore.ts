import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { SqliteTeaRepository } from './sqliteRepositories';
import { ApplicationError } from './errors';

export type Offer = { sku: string; name: string; family: string; image_path: string | null; retail_amount: number | null; stock: number | null; reserved: number; availability: 'IN_STOCK'|'PREORDER'|'REQUEST'|'UNAVAILABLE'; confirmed: number; test_fixture: number; packaging: string; terms_note:string|null; updated_at: string };
export class PartnerTeaRepository extends SqliteTeaRepository {
  constructor(private readonly partnerDb: Database.Database) { super(partnerDb); }
  override getById(id: string) {
    const tea = super.getById(id);
    const row = this.partnerDb.prepare('SELECT stock,reserved FROM partner_catalog WHERE sku=?').get(id) as { stock: number | null; reserved: number } | undefined;
    return tea && row ? { ...tea, inventory: Math.max(0, (row.stock ?? 0) - row.reserved) } : tea;
  }
}

export function offer(db: Database.Database, sku: string): Offer {
  const row = db.prepare('SELECT * FROM partner_catalog WHERE sku=?').get(sku) as Offer | undefined;
  if (!row) throw new ApplicationError('PRODUCT_NOT_FOUND', 'Товар не знайдено');
  return row;
}
export function seedPartnerOffer(db: Database.Database, row: { sku: string; name: string; image?: string; test?: boolean; price?: number; stock?: number; family?:string; procurementNote?:string }) {
  const now = new Date().toISOString();
  db.prepare(`INSERT OR IGNORE INTO partner_catalog(sku,name,image_path,retail_amount,stock,availability,confirmed,test_fixture,updated_at,family,procurement_note) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(row.sku,row.name,row.image ?? null,row.price ?? null,row.stock ?? null,row.test ? 'IN_STOCK':'REQUEST',row.test ? 1:0,row.test ? 1:0,now,row.family??'UNKNOWN',row.procurementNote??null);
  if (row.test) syncCommerceProduct(db, row.sku);
}
/** No owned warehouse or fabricated lot is created: commerce availability comes from partner stock. */
export function syncCommerceProduct(db: Database.Database, sku: string) {
  const p = offer(db,sku), now = new Date().toISOString();
  const eligible = p.confirmed === 1 && p.availability === 'IN_STOCK' && p.retail_amount !== null;
  if (!eligible) { db.prepare('UPDATE commercial_products SET available=0 WHERE sku=?').run(sku); return; }
  db.prepare("INSERT OR IGNORE INTO tea_families(id,name) VALUES('partner-unknown','Уточнюється')").run();
  db.prepare(`INSERT INTO teas(id,slug,name,family_id,sensory_json,discovery_distance,price_amount,price_currency,pack_size_grams,supply_status,provenance_confidence,publishing_state,created_at,updated_at) VALUES(?,?,?,'partner-unknown','{}',0,?,'UAH',1,'available','unknown','published',?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,price_amount=excluded.price_amount,updated_at=excluded.updated_at`).run(sku,sku,p.name,p.retail_amount,now,now);
  db.prepare(`INSERT INTO commercial_products(sku,kind,name,price_amount,price_currency,tea_id,available) VALUES(?,'TEA',?,?,'UAH',?,1) ON CONFLICT(sku) DO UPDATE SET name=excluded.name,price_amount=excluded.price_amount,available=1`).run(sku,p.name,p.retail_amount,sku);
}
export function assertPurchasable(db: Database.Database, sku: string, qty: number) {
  const p = offer(db,sku);
  if (!p.confirmed || p.availability !== 'IN_STOCK' || p.retail_amount === null) throw new ApplicationError('PRODUCT_UNAVAILABLE','Пропозиція потребує підтвердження партнера');
  if (!Number.isSafeInteger(qty) || qty < 1 || qty > 100 || (p.stock ?? 0)-p.reserved < qty) throw new ApplicationError('INSUFFICIENT_INVENTORY','Недостатньо підтвердженого залишку партнера');
}
export function taskEvent(db: Database.Database, orderId: string, actor: string, status: string) {
  db.prepare('INSERT INTO partner_task_events(id,order_id,actor,status,created_at) VALUES(?,?,?,?,?)').run(randomUUID(),orderId,actor,status,new Date().toISOString());
}
