import Database from 'better-sqlite3';
import type { Feedback, RecommendationHistoryEntry, TeaProfile } from '../contracts/account';
import type { Tea } from '../contracts/tea';
import type { TeaTaxonomyReference, TeaWriteInput } from '../application/repositories';

export interface TeaLotRecord {
  id: string;
  teaId: string;
  supplierId?: string;
  provenanceId?: string;
  lotCode: string;
  productionDate?: string;
  harvestYear?: number;
  inventoryQuantity: number;
  supplyStatus: Tea['supplyStatus'];
  createdAt: string;
  updatedAt: string;
}

export interface SupplierRecord {
  id: string;
  name: string;
  createdAt: string;
}

export interface ProvenanceRecord {
  id: string;
  supplierId?: string;
  sourceReference?: string;
  province?: string;
  area?: string;
  region?: string;
  cultivar?: string;
  confidence: Tea['provenanceConfidence'];
  createdAt: string;
}

export interface PersistedCustomer {
  id: string;
  email: string;
  createdAt: string;
}

export function insertSupplier(db: Database.Database, supplier: SupplierRecord): void {
  db.prepare('INSERT INTO suppliers (id, name, created_at) VALUES (?, ?, ?)').run(
    supplier.id,
    supplier.name,
    supplier.createdAt,
  );
}

export function insertProvenance(db: Database.Database, provenance: ProvenanceRecord): void {
  db.prepare(`
    INSERT INTO provenance_records (
      id, supplier_id, source_reference, province, area, region, cultivar, confidence, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    provenance.id,
    provenance.supplierId ?? null,
    provenance.sourceReference ?? null,
    provenance.province ?? null,
    provenance.area ?? null,
    provenance.region ?? null,
    provenance.cultivar ?? null,
    provenance.confidence,
    provenance.createdAt,
  );
}

export function insertTea(
  db: Database.Database,
  tea: TeaWriteInput,
  taxonomy: TeaTaxonomyReference,
): void {
  db.prepare(`
    INSERT INTO teas (
      id, slug, name, chinese_name, transliteration, family_id, subfamily_id, style_id,
      province, area, region, cultivar, harvest_season, harvest_year, processing,
      oxidation_fermentation, production_date, sensory_json, discovery_distance,
      price_amount, price_currency, pack_size_grams, supply_status, provenance_confidence,
      publishing_state, created_at, updated_at
    ) VALUES (
      @id, @slug, @name, @chineseName, @transliteration, @familyId, @subfamilyId, @styleId,
      @province, @area, @region, @cultivar, @harvestSeason, @harvestYear, @processing,
      @oxidationFermentation, @productionDate, @sensoryJson, @discoveryDistance,
      @priceAmount, @priceCurrency, @packSize, @supplyStatus, @provenanceConfidence,
      @publishingState, @createdAt, @updatedAt
    )
  `).run({
    id: tea.id,
    slug: tea.slug,
    name: tea.name,
    chineseName: tea.chineseName ?? null,
    transliteration: tea.transliteration ?? null,
    familyId: taxonomy.familyId,
    subfamilyId: taxonomy.subfamilyId ?? null,
    styleId: taxonomy.styleId ?? null,
    province: tea.province ?? null,
    area: tea.area ?? null,
    region: tea.region ?? null,
    cultivar: tea.cultivar ?? null,
    harvestSeason: tea.harvestSeason ?? null,
    harvestYear: tea.harvestYear ?? null,
    processing: tea.processing ?? null,
    oxidationFermentation: tea.oxidationFermentation ?? null,
    productionDate: tea.productionDate ?? null,
    sensoryJson: JSON.stringify(tea.sensory),
    discoveryDistance: tea.discoveryDistance,
    priceAmount: tea.price.amount,
    priceCurrency: tea.price.currency,
    packSize: tea.packSize,
    supplyStatus: tea.supplyStatus,
    provenanceConfidence: tea.provenanceConfidence,
    publishingState: tea.publishingState,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}

export function findTeaById(db: Database.Database, id: string): Tea | undefined {
  const row = db.prepare(`
    SELECT teas.*, COALESCE(SUM(tea_lots.inventory_quantity), 0) AS inventory_quantity
    FROM teas
    LEFT JOIN tea_lots ON tea_lots.tea_id = teas.id
    WHERE teas.id = ?
    GROUP BY teas.id
  `).get(id) as Record<string, unknown> | undefined;
  if (!row) return undefined;

  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    ...(row.chinese_name ? { chineseName: String(row.chinese_name) } : {}),
    ...(row.transliteration ? { transliteration: String(row.transliteration) } : {}),
    family: String(row.family_id),
    ...(row.subfamily_id ? { subfamily: String(row.subfamily_id) } : {}),
    ...(row.style_id ? { style: String(row.style_id) } : {}),
    ...(row.province ? { province: String(row.province) } : {}),
    ...(row.area ? { area: String(row.area) } : {}),
    ...(row.region ? { region: String(row.region) } : {}),
    ...(row.cultivar ? { cultivar: String(row.cultivar) } : {}),
    ...(row.harvest_season ? { harvestSeason: String(row.harvest_season) } : {}),
    ...(row.harvest_year !== null ? { harvestYear: Number(row.harvest_year) } : {}),
    ...(row.processing ? { processing: String(row.processing) } : {}),
    ...(row.oxidation_fermentation ? { oxidationFermentation: String(row.oxidation_fermentation) } : {}),
    ...(row.production_date ? { productionDate: String(row.production_date) } : {}),
    sensory: JSON.parse(String(row.sensory_json)),
    discoveryDistance: Number(row.discovery_distance),
    price: {
      amount: Number(row.price_amount) as Tea['price']['amount'],
      currency: String(row.price_currency),
    },
    packSize: Number(row.pack_size_grams),
    inventory: Number(row.inventory_quantity),
    supplyStatus: row.supply_status as Tea['supplyStatus'],
    provenanceConfidence: row.provenance_confidence as Tea['provenanceConfidence'],
    publishingState: row.publishing_state as Tea['publishingState'],
  };
}

export function insertTeaLot(db: Database.Database, lot: TeaLotRecord): void {
  db.prepare(`
    INSERT INTO tea_lots (
      id, tea_id, supplier_id, provenance_id, lot_code, production_date,
      harvest_year, inventory_quantity, supply_status, created_at, updated_at
    ) VALUES (
      @id, @teaId, @supplierId, @provenanceId, @lotCode, @productionDate,
      @harvestYear, @inventoryQuantity, @supplyStatus, @createdAt, @updatedAt
    )
  `).run({
    id: lot.id,
    teaId: lot.teaId,
    supplierId: lot.supplierId ?? null,
    provenanceId: lot.provenanceId ?? null,
    lotCode: lot.lotCode,
    productionDate: lot.productionDate ?? null,
    harvestYear: lot.harvestYear ?? null,
    inventoryQuantity: lot.inventoryQuantity,
    supplyStatus: lot.supplyStatus,
    createdAt: lot.createdAt,
    updatedAt: lot.updatedAt,
  });
}

export function insertCustomer(db: Database.Database, customer: PersistedCustomer): void {
  db.prepare('INSERT INTO customers (id, email, created_at) VALUES (?, ?, ?)').run(
    customer.id,
    customer.email,
    customer.createdAt,
  );
}

export function upsertTeaProfile(db: Database.Database, profile: TeaProfile): void {
  db.prepare(`
    INSERT INTO tea_profiles (customer_id, taste_preferences_json, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(customer_id) DO UPDATE SET
      taste_preferences_json = excluded.taste_preferences_json,
      updated_at = excluded.updated_at
  `).run(profile.customerId, JSON.stringify(profile.tastePreferences), profile.updatedAt);

  db.prepare('DELETE FROM customer_tea_preferences WHERE customer_id = ?').run(profile.customerId);
  const insert = db.prepare(
    'INSERT INTO customer_tea_preferences (customer_id, tea_id, preference) VALUES (?, ?, ?)',
  );
  for (const teaId of profile.likedTeaIds) insert.run(profile.customerId, teaId, 'liked');
  for (const teaId of profile.dislikedTeaIds) insert.run(profile.customerId, teaId, 'disliked');
}

export function insertFeedback(db: Database.Database, feedback: Feedback): void {
  db.prepare(`
    INSERT INTO tea_feedback (id, customer_id, tea_id, value, sensory_tags_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    feedback.id,
    feedback.customerId,
    feedback.teaId,
    feedback.value,
    JSON.stringify(feedback.sensoryTags),
    feedback.createdAt,
  );
}

export function insertRecommendationHistory(
  db: Database.Database,
  entry: RecommendationHistoryEntry,
): void {
  db.prepare(`
    INSERT INTO recommendation_history (
      id, customer_id, tea_id, algorithm_version, score, classification,
      reasons_json, context, profile_reference_json, outcome, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.id,
    entry.customerId,
    entry.teaId,
    entry.algorithmVersion,
    entry.score,
    entry.classification,
    JSON.stringify(entry.explanation),
    null,
    JSON.stringify({ customerId: entry.customerId }),
    entry.outcome ?? null,
    entry.createdAt,
  );
}
