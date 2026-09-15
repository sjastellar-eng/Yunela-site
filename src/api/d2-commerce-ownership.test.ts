import { afterEach, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { CustomerService } from '../application/customer/service';
import { DiscoveryBoxApplicationService } from '../application/discoveryBox/service';
import { FeedbackService } from '../application/feedback/service';
import { TeaProfileService } from '../application/profile/service';
import { NotConfiguredRecommendationEngine, RecommendationApplicationService } from '../application/recommendation/service';
import { TeaService } from '../application/tea/service';
import { CartService, OrderService, PurchaseBoundaryService } from '../application/commerce/service';
import { SqliteCartRepository, SqliteCommercialProductRepository, SqliteOrderRepository, SqlitePurchaseRepository } from '../application/sqliteCommerceRepositories';
import { SqliteCustomerRepository, SqliteDiscoveryBoxRepository, SqliteFeedbackRepository, SqliteRecommendationHistoryRepository, SqliteTeaProfileRepository, SqliteTeaRepository } from '../application/sqliteRepositories';
import type { Order } from '../contracts/commerce';
import { createMoney } from '../contracts/commerce';
import { createAnalyticsTracker } from '../contracts/analytics';
import { applyMigrations } from '../database/migrate';
import { openDatabase } from '../database/client';
import { createApiServer, type ApiDependencies } from './server';

let server: Server | undefined;
let closeDatabase: (() => void) | undefined;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    server = undefined;
  }
  closeDatabase?.();
  closeDatabase = undefined;
});

async function startApi(dependencies: ApiDependencies): Promise<string> {
  server = createApiServer({ dependencies });
  await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not expose an address');
  return `http://127.0.0.1:${address.port}`;
}

async function json(response: Response): Promise<unknown> {
  return response.json();
}

function setup(): { db: ReturnType<typeof openDatabase>; dependencies: ApiDependencies; customerService: CustomerService } {
  const db = openDatabase(':memory:');
  applyMigrations(db);
  const customerRepository = new SqliteCustomerRepository(db);
  const customerService = new CustomerService(customerRepository);
  const teaRepository = new SqliteTeaRepository(db);
  const profileRepository = new SqliteTeaProfileRepository(db);
  const historyRepository = new SqliteRecommendationHistoryRepository(db);
  const recommendationService = new RecommendationApplicationService(new NotConfiguredRecommendationEngine());
  const analytics = createAnalyticsTracker(() => undefined);
  const cartRepository = new SqliteCartRepository(db);
  const orderRepository = new SqliteOrderRepository(db);
  const purchaseRepository = new SqlitePurchaseRepository(db);
  const dependencies: ApiDependencies = {
    teaService: new TeaService(teaRepository),
    customerService,
    profileService: new TeaProfileService(profileRepository, customerRepository),
    feedbackService: new FeedbackService(new SqliteFeedbackRepository(db), customerRepository, teaRepository, profileRepository),
    recommendationService,
    discoveryBoxService: new DiscoveryBoxApplicationService({
      recommendationService,
      boxRepository: new SqliteDiscoveryBoxRepository(db),
    }),
    commerce: {
      cartService: new CartService(cartRepository, new SqliteCommercialProductRepository(db), teaRepository, customerRepository, new SqliteDiscoveryBoxRepository(db), historyRepository, analytics),
      orderService: new OrderService(orderRepository, cartRepository, new SqliteCommercialProductRepository(db), teaRepository, new SqliteDiscoveryBoxRepository(db), customerRepository, analytics),
      purchaseBoundary: new PurchaseBoundaryService(purchaseRepository, orderRepository, analytics),
    },
  };
  closeDatabase = () => db.close();
  return { db, dependencies, customerService };
}

function addCustomer(customerService: CustomerService, id: string): void {
  customerService.createCustomer({ id, email: `${id}@example.invalid`, createdAt: new Date().toISOString() });
}

function seedOrder(db: ReturnType<typeof openDatabase>, customerId: string, id: string): void {
  const order: Order = {
    id,
    customerId,
    status: 'created',
    items: [{
      id: `${id}-item`, sku: 'SKU-TEST', teaName: 'Test Tea', quantity: 1,
      unitPrice: createMoney(1000, 'UAH'), lineTotal: createMoney(1000, 'UAH'),
    }],
    pricingSnapshot: {
      subtotal: createMoney(1000, 'UAH'), discounts: createMoney(0, 'UAH'),
      shipping: createMoney(0, 'UAH'), total: createMoney(1000, 'UAH'),
    },
    shipping: { recipientName: 'Test', addressLine1: 'Test', city: 'Test', postalCode: '00000', countryCode: 'UA' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  new SqliteOrderRepository(db).create(order, `${id}-key`);
}

describe('D2 anonymous customer ownership header', () => {
  it('requires X-Customer-Id and never creates a customer implicitly', async () => {
    const { dependencies } = setup();
    const base = await startApi(dependencies);
    const response = await fetch(`${base}/api/v1/carts`, { method: 'POST' });
    expect(response.status).toBe(400);
    expect((await json(response) as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
  });

  it('uses only X-Customer-Id for cart creation and ignores customerId in the body', async () => {
    const { dependencies, customerService } = setup();
    addCustomer(customerService, 'customer-a');
    addCustomer(customerService, 'customer-b');
    const base = await startApi(dependencies);

    const response = await fetch(`${base}/api/v1/carts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-customer-id': 'customer-a' },
      body: JSON.stringify({ customerId: 'customer-b' }),
    });
    expect(response.status).toBe(201);
    const cart = await json(response) as { customerId: string };
    expect(cart.customerId).toBe('customer-a');
  });

  it('rejects unknown X-Customer-Id without creating an identity', async () => {
    const { dependencies, db } = setup();
    const base = await startApi(dependencies);
    const response = await fetch(`${base}/api/v1/carts`, {
      method: 'POST', headers: { 'x-customer-id': 'unknown-customer' },
    });
    expect(response.status).toBe(404);
    expect((await json(response) as { error: { code: string } }).error.code).toBe('NOT_FOUND');
    const count = db.prepare('SELECT COUNT(*) AS count FROM customers').get() as { count: number };
    expect(count.count).toBe(0);
  });

  it('enforces cart ownership on reads and item routes', async () => {
    const { dependencies, customerService } = setup();
    addCustomer(customerService, 'customer-a');
    addCustomer(customerService, 'customer-b');
    const cart = dependencies.commerce!.cartService.createCart('customer-a');
    const base = await startApi(dependencies);

    const foreignRead = await fetch(`${base}/api/v1/carts/${cart.id}`, { headers: { 'x-customer-id': 'customer-b' } });
    expect(foreignRead.status).toBe(403);
    expect((await json(foreignRead) as { error: { code: string } }).error.code).toBe('CART_NOT_OWNED');

    const foreignItems = await fetch(`${base}/api/v1/carts/${cart.id}/items`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-customer-id': 'customer-b' },
      body: JSON.stringify({ sku: 'SKU-TEST', quantity: 1 }),
    });
    expect(foreignItems.status).toBe(403);
    expect((await json(foreignItems) as { error: { code: string } }).error.code).toBe('CART_NOT_OWNED');
  });

  it('enforces order ownership through X-Customer-Id', async () => {
    const { dependencies, customerService, db } = setup();
    addCustomer(customerService, 'customer-a');
    addCustomer(customerService, 'customer-b');
    seedOrder(db, 'customer-a', 'order-a');
    const base = await startApi(dependencies);

    const foreign = await fetch(`${base}/api/v1/orders/order-a`, { headers: { 'x-customer-id': 'customer-b' } });
    expect(foreign.status).toBe(403);
    expect((await json(foreign) as { error: { code: string } }).error.code).toBe('ORDER_NOT_OWNED');

    const owner = await fetch(`${base}/api/v1/orders/order-a`, { headers: { 'x-customer-id': 'customer-a' } });
    expect(owner.status).toBe(200);
    expect((await json(owner) as { customerId: string }).customerId).toBe('customer-a');
  });

  it('supports DELETE cart item with the literal HTTP DELETE method', async () => {
    const { dependencies, customerService } = setup();
    addCustomer(customerService, 'customer-a');
    const cart = dependencies.commerce!.cartService.createCart('customer-a');
    const base = await startApi(dependencies);
    const response = await fetch(`${base}/api/v1/carts/${cart.id}/items/SKU-TEST`, {
      method: 'DELETE', headers: { 'x-customer-id': 'customer-a' },
    });
    expect(response.status).toBe(404);
    expect((await json(response) as { error: { code: string } }).error.code).toBe('CART_ITEM_NOT_FOUND');
  });
});
