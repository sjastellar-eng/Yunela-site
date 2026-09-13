import { afterEach, describe, expect, it } from 'vitest';
import { createMoney } from '../contracts/commerce';
import type { Customer, Feedback, TeaProfile } from '../contracts/account';
import type { Tea } from '../contracts/tea';
import { openDatabase } from '../database/client';
import { applyMigrations } from '../database/migrate';
import { CustomerService } from './customer/service';
import { FeedbackService } from './feedback/service';
import { TeaProfileService } from './profile/service';
import { SqliteCustomerRepository, SqliteFeedbackRepository, SqliteTeaProfileRepository, SqliteTeaRepository } from './sqliteRepositories';
import { TeaService } from './tea/service';

const databases: ReturnType<typeof openDatabase>[] = [];

function createDatabase() {
  const db = openDatabase();
  databases.push(db);
  applyMigrations(db);
  db.prepare('INSERT INTO tea_families (id, name) VALUES (?, ?)').run('family-oolong', 'Synthetic Oolong Family');
  db.prepare('INSERT INTO tea_subfamilies (id, family_id, name) VALUES (?, ?, ?)').run('subfamily-roasted', 'family-oolong', 'Synthetic Roasted Subfamily');
  db.prepare('INSERT INTO tea_styles (id, subfamily_id, name) VALUES (?, ?, ?)').run('style-test', 'subfamily-roasted', 'Synthetic Style');
  return db;
}

function tea(): Tea {
  return {
    id: 'tea-c1', slug: 'tea-c1', name: 'Synthetic C1 Tea', family: 'family-oolong', subfamily: 'subfamily-roasted', style: 'style-test',
    sensory: { aroma: ['synthetic'], sweetness: 50, body: 50, freshness: 50, roast: 50, depth: 50, astringency: 20, finish: 50, floral: 10, fruity: 10, mineral: 10, earthyWoody: 40 },
    discoveryDistance: 20, price: createMoney(1999, 'USD'), packSize: 50, inventory: 0,
    supplyStatus: 'unknown', provenanceConfidence: 'unknown', publishingState: 'draft',
  };
}

function customer(): Customer {
  return { id: 'customer-c1', email: 'c1@example.invalid', createdAt: '2026-09-13T20:00:00.000Z' };
}

afterEach(() => { while (databases.length) databases.pop()?.close(); });

describe('C1 SQLite repository adapters', () => {
  it('runs TeaService against the SQLite repository without changing the service', () => {
    const db = createDatabase();
    const service = new TeaService(new SqliteTeaRepository(db));
    expect(service.createTea(tea(), { familyId: 'family-oolong', subfamilyId: 'subfamily-roasted', styleId: 'style-test' }).id).toBe('tea-c1');
    expect(service.getTeaById('tea-c1').name).toBe('Synthetic C1 Tea');
    expect(service.updateTea({ ...tea(), name: 'Updated C1 Tea' }, { familyId: 'family-oolong', subfamilyId: 'subfamily-roasted', styleId: 'style-test' }).name).toBe('Updated C1 Tea');
  });

  it('runs customer, profile and feedback services through repository adapters', () => {
    const db = createDatabase();
    const teaService = new TeaService(new SqliteTeaRepository(db));
    teaService.createTea(tea(), { familyId: 'family-oolong', subfamilyId: 'subfamily-roasted', styleId: 'style-test' });

    const customerRepository = new SqliteCustomerRepository(db);
    const customerService = new CustomerService(customerRepository);
    customerService.createCustomer(customer());

    const profileService = new TeaProfileService(new SqliteTeaProfileRepository(db), customerRepository);
    const profile: TeaProfile = {
      customerId: 'customer-c1', purchasedTeaIds: [], likedTeaIds: ['tea-c1'], dislikedTeaIds: [],
      tastePreferences: { body: 60 }, feedbackIds: [], recommendationIds: [], updatedAt: '2026-09-13T20:00:00.000Z',
    };
    profileService.createTeaProfile(profile);

    const feedbackService = new FeedbackService(new SqliteFeedbackRepository(db), customerRepository, new SqliteTeaRepository(db));
    const feedback: Feedback = {
      id: 'feedback-c1', customerId: 'customer-c1', teaId: 'tea-c1', value: 'Liked it', sensoryTags: ['synthetic'], createdAt: '2026-09-13T20:00:00.000Z',
    };
    feedbackService.submitFeedback(feedback);

    const persisted = profileService.getTeaProfile('customer-c1');
    expect(persisted.likedTeaIds).toEqual(['tea-c1']);
    expect(persisted.purchasedTeaIds).toEqual([]);
    expect(persisted.feedbackIds).toEqual(['feedback-c1']);
    expect(feedbackService.getCustomerFeedback('customer-c1')).toEqual([feedback]);
  });
});
