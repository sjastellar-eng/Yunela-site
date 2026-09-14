import { describe, expect, it } from 'vitest';
import { createMoney } from '../contracts/commerce';
import type { Customer, Feedback, TeaProfile } from '../contracts/account';
import type { Tea } from '../contracts/tea';
import { CustomerService } from './customer/service';
import { FeedbackService } from './feedback/service';
import { TeaProfileService } from './profile/service';
import type { CustomerRepository, FeedbackRepository, TeaProfileRepository, TeaRepository } from './repositories';
import { TeaService } from './tea/service';

class Customers implements CustomerRepository {
  readonly records = new Map<string, Customer>();
  create(value: Customer): void { this.records.set(value.id, value); }
  getById(id: string): Customer | undefined { return this.records.get(id); }
  update(value: Customer): Customer | undefined { if (!this.records.has(value.id)) return undefined; this.records.set(value.id, value); return value; }
}
class Teas implements TeaRepository {
  readonly records = new Map<string, Tea>();
  create(value: Omit<Tea, 'inventory'>): void { this.records.set(value.id, { ...value, inventory: 0 }); }
  getById(id: string): Tea | undefined { return this.records.get(id); }
  list(): Tea[] { return [...this.records.values()]; }
  update(value: Omit<Tea, 'inventory'>): Tea | undefined { if (!this.records.has(value.id)) return undefined; const updated = { ...value, inventory: 0 }; this.records.set(value.id, updated); return updated; }
}
class Profiles implements TeaProfileRepository {
  readonly records = new Map<string, TeaProfile>();
  getByCustomerId(customerId: string): TeaProfile | undefined { return this.records.get(customerId); }
  upsert(value: TeaProfile): void { this.records.set(value.customerId, value); }
}
class Feedbacks implements FeedbackRepository {
  readonly records: Feedback[] = [];
  create(value: Feedback): void { this.records.push(value); }
  listByCustomerId(customerId: string): Feedback[] { return this.records.filter((item) => item.customerId === customerId); }
  listByTeaId(teaId: string): Feedback[] { return this.records.filter((item) => item.teaId === teaId); }
}

const taxonomy = { familyId: 'family-oolong', subfamilyId: 'subfamily-roasted', styleId: 'style-test' };
function createTea(id = 'tea-c5'): Tea {
  return { id, slug: id, name: 'Synthetic C5 Tea', family: taxonomy.familyId, subfamily: taxonomy.subfamilyId, style: taxonomy.styleId,
    sensory: { aroma: ['synthetic'], sweetness: 50, body: 50, freshness: 50, roast: 50, depth: 50, astringency: 20, finish: 50, floral: 10, fruity: 10, mineral: 10, earthyWoody: 40 },
    discoveryDistance: 20, price: createMoney(1999, 'USD'), packSize: 50, inventory: 0, supplyStatus: 'unknown', provenanceConfidence: 'unknown', publishingState: 'draft' };
}

function setup() {
  const customers = new Customers();
  const teas = new Teas();
  const profiles = new Profiles();
  const feedbacks = new Feedbacks();
  customers.create({ id: 'customer-c5', email: 'c5@example.invalid', createdAt: '2026-09-14T10:00:00.000Z' });
  const { inventory, ...writeTea } = createTea();
  void inventory;
  teas.create(writeTea);
  const feedbackService = new FeedbackService(feedbacks, customers, teas, profiles);
  return { customers, teas, profiles, feedbacks, feedbackService };
}

describe('C5 Feedback → Tea Profile application flow', () => {
  it('creates the derived profile from feedback and preserves raw feedback unchanged', () => {
    const { feedbackService, profiles, feedbacks } = setup();
    const event: Feedback = { id: 'feedback-1', customerId: 'customer-c5', teaId: 'tea-c5', value: 'Loved it', sensoryTags: [' Sweet ', 'Floral', 'unsupported'], createdAt: '2026-09-14T10:01:00.000Z' };
    expect(feedbackService.submitFeedback(event)).toEqual(event);
    expect(feedbacks.records).toEqual([event]);
    expect(profiles.records.get('customer-c5')?.tastePreferences).toEqual({ sweetness: 60, aroma: ['floral'] });
  });

  it('applies repeated events independently and rebuilds deterministically', () => {
    const { feedbackService, profiles } = setup();
    feedbackService.submitFeedback({ id: 'feedback-1', customerId: 'customer-c5', teaId: 'tea-c5', value: 'Loved it', sensoryTags: ['sweet'], createdAt: '2026-09-14T10:01:00.000Z' });
    feedbackService.submitFeedback({ id: 'feedback-2', customerId: 'customer-c5', teaId: 'tea-c5', value: 'Not for me', sensoryTags: ['sweet'], createdAt: '2026-09-14T10:02:00.000Z' });
    const first = profiles.records.get('customer-c5');
    expect(first?.tastePreferences.sweetness).toBe(50);
    const rebuilt = feedbackService.rebuildCustomerProfile('customer-c5');
    expect(rebuilt).toEqual(first);
  });

  it('is idempotent for a duplicate feedback event', () => {
    const { feedbackService, profiles } = setup();
    const event: Feedback = { id: 'feedback-1', customerId: 'customer-c5', teaId: 'tea-c5', value: 'Loved it', sensoryTags: ['sweet'], createdAt: '2026-09-14T10:01:00.000Z' };
    feedbackService.submitFeedback(event);
    expect(() => feedbackService.submitFeedback(event)).toThrow(/already exists/);
    expect(profiles.records.get('customer-c5')?.tastePreferences.sweetness).toBe(60);
  });

  it('projects the derived profile to the existing FinderProfileReference', () => {
    const { feedbackService } = setup();
    feedbackService.submitFeedback({ id: 'feedback-1', customerId: 'customer-c5', teaId: 'tea-c5', value: 'Liked it', sensoryTags: ['fresh', 'roasted'], createdAt: '2026-09-14T10:01:00.000Z' });
    expect(feedbackService.getFinderProfileReference('customer-c5')).toEqual({ freshness: 55, roastDepth: 55 });
  });

  it('keeps customer and tea validation before persistence', () => {
    const { feedbackService, profiles, feedbacks } = setup();
    expect(() => feedbackService.submitFeedback({ id: 'missing-customer', customerId: 'missing', teaId: 'tea-c5', value: 'Loved it', sensoryTags: ['sweet'], createdAt: '2026-09-14T10:01:00.000Z' })).toThrow(/Customer missing/);
    expect(() => feedbackService.submitFeedback({ id: 'missing-tea', customerId: 'customer-c5', teaId: 'missing', value: 'Loved it', sensoryTags: ['sweet'], createdAt: '2026-09-14T10:01:00.000Z' })).toThrow(/Tea missing/);
    expect(feedbacks.records).toHaveLength(0);
    expect(profiles.records).toHaveLength(0);
  });

  it('does not alter C3/C4 services; only the feedback/profile boundary is exercised', () => {
    const { customers, teas } = setup();
    expect(new CustomerService(customers).getCustomer('customer-c5').id).toBe('customer-c5');
    const { inventory, ...writeTea } = createTea();
    void inventory;
    expect(new TeaService(teas).getTeaById(writeTea.id).id).toBe(writeTea.id);
    expect(TeaProfileService).toBeDefined();
  });
});
