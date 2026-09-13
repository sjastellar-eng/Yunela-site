import { describe, expect, it } from 'vitest';
import { createMoney } from '../contracts/commerce';
import type { Customer, Feedback, TeaProfile } from '../contracts/account';
import type { RecommendationRequest, RecommendationResult } from '../contracts/recommendation';
import type { Tea } from '../contracts/tea';
import { ApplicationError } from './errors';
import { CustomerService } from './customer/service';
import { FeedbackService } from './feedback/service';
import { TeaProfileService } from './profile/service';
import { RecommendationApplicationService } from './recommendation/service';
import type { CustomerRepository, FeedbackRepository, TeaProfileRepository, TeaRepository, TeaTaxonomyReference, TeaWriteInput } from './repositories';
import { TeaService } from './tea/service';

const taxonomy: TeaTaxonomyReference = { familyId: 'family-oolong', subfamilyId: 'subfamily-roasted', styleId: 'style-test' };

function tea(id = 'tea-1'): Tea {
  return {
    id,
    slug: id,
    name: 'Synthetic Test Tea',
    family: 'family-oolong',
    subfamily: 'subfamily-roasted',
    style: 'style-test',
    sensory: { aroma: ['synthetic'], sweetness: 50, body: 50, freshness: 50, roast: 50, depth: 50, astringency: 20, finish: 50, floral: 10, fruity: 10, mineral: 10, earthyWoody: 40 },
    discoveryDistance: 20,
    price: createMoney(1999, 'USD'),
    packSize: 50,
    inventory: 0,
    supplyStatus: 'unknown',
    provenanceConfidence: 'unknown',
    publishingState: 'draft',
  };
}

function teaWriteInput(id = 'tea-1'): TeaWriteInput {
  const { inventory, ...writeInput } = tea(id);
  void inventory;
  return writeInput;
}

function customer(id = 'customer-1'): Customer {
  return { id, email: `${id}@example.invalid`, createdAt: '2026-09-13T20:00:00.000Z' };
}

class FakeTeaRepository implements TeaRepository {
  readonly records = new Map<string, Tea>();
  failCreate = false;
  create(value: TeaWriteInput): void {
    if (this.failCreate) throw new ApplicationError('PERSISTENCE_ERROR', 'synthetic repository failure');
    this.records.set(value.id, { ...value, inventory: 0 });
  }
  getById(id: string): Tea | undefined { return this.records.get(id); }
  list(): Tea[] { return [...this.records.values()]; }
  update(value: TeaWriteInput): Tea | undefined {
    if (!this.records.has(value.id)) return undefined;
    const updated = { ...value, inventory: this.records.get(value.id)?.inventory ?? 0 };
    this.records.set(value.id, updated);
    return updated;
  }
}

class FakeCustomerRepository implements CustomerRepository {
  readonly records = new Map<string, Customer>();
  create(value: Customer): void { this.records.set(value.id, value); }
  getById(id: string): Customer | undefined { return this.records.get(id); }
  update(value: Customer): Customer | undefined {
    if (!this.records.has(value.id)) return undefined;
    this.records.set(value.id, value);
    return value;
  }
}

class FakeProfileRepository implements TeaProfileRepository {
  readonly records = new Map<string, TeaProfile>();
  getByCustomerId(customerId: string): TeaProfile | undefined { return this.records.get(customerId); }
  upsert(value: TeaProfile): void { this.records.set(value.customerId, value); }
}

class FakeFeedbackRepository implements FeedbackRepository {
  readonly records: Feedback[] = [];
  create(value: Feedback): void { this.records.push(value); }
  listByCustomerId(customerId: string): Feedback[] { return this.records.filter((item) => item.customerId === customerId); }
  listByTeaId(teaId: string): Feedback[] { return this.records.filter((item) => item.teaId === teaId); }
}

const profile = (customerId = 'customer-1'): TeaProfile => ({
  customerId,
  purchasedTeaIds: [],
  likedTeaIds: ['tea-1'],
  dislikedTeaIds: [],
  tastePreferences: { body: 60, sweetness: 40 },
  feedbackIds: [],
  recommendationIds: [],
  updatedAt: '2026-09-13T20:00:00.000Z',
});

const feedback = (): Feedback => ({
  id: 'feedback-1',
  customerId: 'customer-1',
  teaId: 'tea-1',
  value: 'Loved it',
  sensoryTags: ['sweet'],
  createdAt: '2026-09-13T20:00:00.000Z',
});

describe('C1 application services', () => {
  it('TeaService supports create, read and update without a SQLite dependency', () => {
    const repository = new FakeTeaRepository();
    const service = new TeaService(repository);
    const created = service.createTea(teaWriteInput(), taxonomy);
    expect(service.getTeaById(created.id).name).toBe('Synthetic Test Tea');
    const updated = service.updateTea({ ...created, name: 'Updated Synthetic Tea' }, taxonomy);
    expect(updated.name).toBe('Updated Synthetic Tea');
    expect(service.listTeas()).toHaveLength(1);
  });

  it('TeaService treats inventory as derived rather than authoritative input', () => {
    const repository = new FakeTeaRepository();
    const service = new TeaService(repository);
    const inventoryBearingObject = { ...teaWriteInput('tea-inventory'), inventory: 999 };
    const created = service.createTea(inventoryBearingObject, taxonomy);
    expect(created.inventory).toBe(0);
    expect(repository.records.get('tea-inventory')?.inventory).toBe(0);
  });

  it('TeaService rejects invalid data and inconsistent taxonomy references', () => {
    const service = new TeaService(new FakeTeaRepository());
    const invalidTea = { ...teaWriteInput(), price: { ...tea().price, amount: -1 as Tea['price']['amount'] } };
    expect(() => service.createTea(invalidTea, taxonomy)).toThrow(ApplicationError);
    expect(() => service.createTea(teaWriteInput('tea-family-mismatch'), { ...taxonomy, familyId: 'family-other' })).toThrowError(/tea.family must match taxonomy.familyId/);
    expect(() => service.createTea(teaWriteInput('tea-subfamily-mismatch'), { ...taxonomy, subfamilyId: 'subfamily-other' })).toThrowError(/tea.subfamily must match taxonomy.subfamilyId/);
    expect(() => service.createTea(teaWriteInput('tea-style-mismatch'), { ...taxonomy, styleId: 'style-other' })).toThrowError(/tea.style must match taxonomy.styleId/);
  });

  it('TeaService propagates repository failure as an application error', () => {
    const repository = new FakeTeaRepository();
    const service = new TeaService(repository);
    repository.failCreate = true;
    expect(() => service.createTea(teaWriteInput('tea-2'), taxonomy)).toThrowError('synthetic repository failure');
  });

  it('CustomerService supports create, read, update and not-found handling', () => {
    const repository = new FakeCustomerRepository();
    const service = new CustomerService(repository);
    const created = service.createCustomer(customer());
    expect(service.getCustomer(created.id)).toEqual(created);
    expect(service.updateCustomer({ ...created, email: 'updated@example.invalid' }).email).toBe('updated@example.invalid');
    expect(() => service.getCustomer('missing')).toThrowError(/was not found/);
  });

  it('TeaProfileService creates, reads and updates a customer-linked profile', () => {
    const customers = new FakeCustomerRepository();
    const profiles = new FakeProfileRepository();
    customers.create(customer());
    const service = new TeaProfileService(profiles, customers);
    const created = service.createTeaProfile(profile());
    expect(service.getTeaProfile(created.customerId).likedTeaIds).toEqual(['tea-1']);
    expect(service.updateTeaProfile({ ...created, likedTeaIds: [], dislikedTeaIds: ['tea-1'] }).dislikedTeaIds).toEqual(['tea-1']);
    expect(() => service.getTeaProfile('missing')).toThrowError(/Customer missing was not found/);
  });

  it('FeedbackService submits valid feedback and enforces customer/tea references', () => {
    const customers = new FakeCustomerRepository();
    const teas = new FakeTeaRepository();
    const feedbackRepository = new FakeFeedbackRepository();
    customers.create(customer());
    teas.create(teaWriteInput());
    const service = new FeedbackService(feedbackRepository, customers, teas);
    expect(service.submitFeedback(feedback())).toEqual(feedback());
    expect(service.getCustomerFeedback('customer-1')).toHaveLength(1);
    expect(service.getTeaFeedback('tea-1')).toHaveLength(1);
    expect(() => service.submitFeedback({ ...feedback(), id: 'bad', value: 'invalid' as Feedback['value'] })).toThrow(ApplicationError);
    expect(() => service.submitFeedback({ ...feedback(), id: 'missing-customer', customerId: 'missing' })).toThrowError(/Customer missing/);
    expect(() => service.submitFeedback({ ...feedback(), id: 'missing-tea', teaId: 'missing' })).toThrowError(/Tea missing/);
  });

  it('RecommendationApplicationService preserves the PR #2 contract and validates algorithm version', async () => {
    const request: RecommendationRequest = { profileReference: { body: 60 }, candidateTeaIds: ['tea-1'] };
    const result: RecommendationResult = {
      tea: { id: 'tea-1', slug: 'tea-1', name: 'Synthetic Test Tea' },
      classification: 'MATCH',
      score: 82,
      reasons: ['synthetic fit'],
      algorithmVersion: 'v1-test',
      profileReference: request.profileReference,
      createdAt: '2026-09-13T20:00:00.000Z',
    };
    const service = new RecommendationApplicationService({ recommend: async () => [result] });
    await expect(service.recommend(request)).resolves.toEqual([result]);
    await expect(new RecommendationApplicationService({ recommend: async () => [{ ...result, algorithmVersion: '' }] }).recommend(request)).rejects.toThrow(ApplicationError);
  });
});
