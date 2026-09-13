import Database from 'better-sqlite3';
import type { Feedback, Customer, RecommendationHistoryEntry, TeaProfile } from '../contracts/account';
import type { Tea } from '../contracts/tea';
import { findTeaById, insertCustomer, insertFeedback, insertRecommendationHistory, insertTea, upsertTeaProfile } from '../database/repositories';
import type {
  CustomerRepository,
  FeedbackRepository,
  RecommendationHistoryRepository,
  TeaProfileRepository,
  TeaRepository,
  TeaTaxonomyReference,
  TeaWriteInput,
} from './repositories';
import { ApplicationError, toPersistenceError } from './errors';

function mapPersistenceError(error: unknown): ApplicationError {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('UNIQUE constraint failed')) {
    return new ApplicationError('CONFLICT', 'A record with the same unique value already exists', { cause: error });
  }
  return toPersistenceError(error);
}

function withPersistence<T>(operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    throw mapPersistenceError(error);
  }
}

function mapFeedback(row: Record<string, unknown>): Feedback {
  return {
    id: String(row.id),
    customerId: String(row.customer_id),
    teaId: String(row.tea_id),
    value: row.value as Feedback['value'],
    sensoryTags: JSON.parse(String(row.sensory_tags_json)) as string[],
    createdAt: String(row.created_at),
  };
}

export class SqliteTeaRepository implements TeaRepository {
  constructor(private readonly db: Database.Database) {}

  create(tea: TeaWriteInput, taxonomy: TeaTaxonomyReference): void {
    withPersistence(() => insertTea(this.db, tea, taxonomy));
  }

  getById(id: string): Tea | undefined {
    return withPersistence(() => findTeaById(this.db, id));
  }

  list(): Tea[] {
    return withPersistence(() => {
      const ids = this.db.prepare('SELECT id FROM teas ORDER BY name, id').all() as Array<{ id: string }>;
      return ids.flatMap(({ id }) => {
        const tea = findTeaById(this.db, id);
        return tea ? [tea] : [];
      });
    });
  }

  update(tea: TeaWriteInput, taxonomy: TeaTaxonomyReference): Tea | undefined {
    return withPersistence(() => {
      const result = this.db.prepare(`
        UPDATE teas SET
          slug = @slug,
          name = @name,
          chinese_name = @chineseName,
          transliteration = @transliteration,
          family_id = @familyId,
          subfamily_id = @subfamilyId,
          style_id = @styleId,
          province = @province,
          area = @area,
          region = @region,
          cultivar = @cultivar,
          harvest_season = @harvestSeason,
          harvest_year = @harvestYear,
          processing = @processing,
          oxidation_fermentation = @oxidationFermentation,
          production_date = @productionDate,
          sensory_json = @sensoryJson,
          discovery_distance = @discoveryDistance,
          price_amount = @priceAmount,
          price_currency = @priceCurrency,
          pack_size_grams = @packSize,
          supply_status = @supplyStatus,
          provenance_confidence = @provenanceConfidence,
          publishing_state = @publishingState,
          updated_at = @updatedAt
        WHERE id = @id
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
        updatedAt: new Date().toISOString(),
      });
      return result.changes === 0 ? undefined : findTeaById(this.db, tea.id);
    });
  }
}

export class SqliteCustomerRepository implements CustomerRepository {
  constructor(private readonly db: Database.Database) {}

  create(customer: Customer): void {
    withPersistence(() => insertCustomer(this.db, customer));
  }

  getById(id: string): Customer | undefined {
    return withPersistence(() => {
      const row = this.db.prepare('SELECT id, email, created_at FROM customers WHERE id = ?').get(id) as Record<string, unknown> | undefined;
      return row
        ? { id: String(row.id), email: String(row.email), createdAt: String(row.created_at) }
        : undefined;
    });
  }

  update(customer: Customer): Customer | undefined {
    return withPersistence(() => {
      const result = this.db.prepare('UPDATE customers SET email = ? WHERE id = ?').run(customer.email, customer.id);
      return result.changes === 0 ? undefined : this.getById(customer.id);
    });
  }
}

export class SqliteTeaProfileRepository implements TeaProfileRepository {
  constructor(private readonly db: Database.Database) {}

  getByCustomerId(customerId: string): TeaProfile | undefined {
    return withPersistence(() => {
      const profileRow = this.db.prepare(
        'SELECT taste_preferences_json, updated_at FROM tea_profiles WHERE customer_id = ?',
      ).get(customerId) as Record<string, unknown> | undefined;
      if (!profileRow) return undefined;

      const preferences = this.db.prepare(
        'SELECT tea_id, preference FROM customer_tea_preferences WHERE customer_id = ? ORDER BY tea_id',
      ).all(customerId) as Array<{ tea_id: string; preference: 'liked' | 'disliked' }>;
      const feedbackIds = this.db.prepare(
        'SELECT id FROM tea_feedback WHERE customer_id = ? ORDER BY created_at, id',
      ).all(customerId) as Array<{ id: string }>;
      const recommendationIds = this.db.prepare(
        'SELECT id FROM recommendation_history WHERE customer_id = ? ORDER BY created_at, id',
      ).all(customerId) as Array<{ id: string }>;

      return {
        customerId,
        purchasedTeaIds: [],
        likedTeaIds: preferences.filter((row) => row.preference === 'liked').map((row) => row.tea_id),
        dislikedTeaIds: preferences.filter((row) => row.preference === 'disliked').map((row) => row.tea_id),
        tastePreferences: JSON.parse(String(profileRow.taste_preferences_json)),
        feedbackIds: feedbackIds.map(({ id }) => id),
        recommendationIds: recommendationIds.map(({ id }) => id),
        updatedAt: String(profileRow.updated_at),
      };
    });
  }

  upsert(profile: TeaProfile): void {
    withPersistence(() => upsertTeaProfile(this.db, profile));
  }
}

export class SqliteFeedbackRepository implements FeedbackRepository {
  constructor(private readonly db: Database.Database) {}

  create(feedback: Feedback): void {
    withPersistence(() => insertFeedback(this.db, feedback));
  }

  listByCustomerId(customerId: string): Feedback[] {
    return withPersistence(() => {
      const rows = this.db.prepare(
        'SELECT id, customer_id, tea_id, value, sensory_tags_json, created_at FROM tea_feedback WHERE customer_id = ? ORDER BY created_at, id',
      ).all(customerId) as Array<Record<string, unknown>>;
      return rows.map(mapFeedback);
    });
  }

  listByTeaId(teaId: string): Feedback[] {
    return withPersistence(() => {
      const rows = this.db.prepare(
        'SELECT id, customer_id, tea_id, value, sensory_tags_json, created_at FROM tea_feedback WHERE tea_id = ? ORDER BY created_at, id',
      ).all(teaId) as Array<Record<string, unknown>>;
      return rows.map(mapFeedback);
    });
  }
}

export class SqliteRecommendationHistoryRepository implements RecommendationHistoryRepository {
  constructor(private readonly db: Database.Database) {}

  create(entry: RecommendationHistoryEntry): void {
    withPersistence(() => insertRecommendationHistory(this.db, entry));
  }
}
