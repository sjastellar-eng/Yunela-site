import { describe, expect, it } from 'vitest';
import { createMoney } from '../../contracts/commerce';
import type { AnalyticsEventName, AnalyticsTracker } from '../../contracts/analytics';
import type { CommercialProduct } from '../../contracts/catalog';
import type { Customer, RecommendationHistoryEntry } from '../../contracts/account';
import type { DiscoveryBox } from '../../contracts/discoveryBox';
import type { Tea } from '../../contracts/tea';
import { CartService, OrderService, PurchaseBoundaryService } from './service';
import type { CartRepository, OrderRepository, PurchaseRepository } from './repositories';
import type { CustomerRepository, DiscoveryBoxRepository, RecommendationHistoryRepository, TeaRepository } from '../repositories';

const tea: Tea = { id: 'tea-1', slug: 'tea-1', name: 'Tea One', family: 'oolong', sensory: { aroma: [], sweetness: 50, body: 50, freshness: 50, roast: 50, depth: 50, astringency: 20, finish: 50, floral: 0, fruity: 0, mineral: 0, earthyWoody: 0 }, discoveryDistance: 20, price: createMoney(999, 'UAH'), packSize: 50, inventory: 10, supplyStatus: 'available', provenanceConfidence: 'verified', publishingState: 'published' };
const product: CommercialProduct = { sku: 'YUNELA-TEA-001', kind: 'TEA', name: tea.name, price: createMoney(1299, 'UAH'), teaId: tea.id, available: true };
const customer: Customer = { id: 'customer-1', email: 'customer-1@example.invalid', createdAt: new Date().toISOString() };

class FakeCustomers implements CustomerRepository { getById(id: string) { return id === customer.id ? customer : undefined; } create() {} update(value: Customer) { return value; } }
class FakeTeas implements TeaRepository { getById(id: string) { return id === tea.id ? tea : undefined; } create() {} list() { return [tea]; } update(value: Omit<Tea, 'inventory'>) { return { ...tea, ...value }; } }
class FakeProducts implements import('../../contracts/catalog').CommercialProductRepository { getBySku(sku: string) { return sku === product.sku ? product : undefined; } }
class FakeBoxes implements DiscoveryBoxRepository { getById(): DiscoveryBox | undefined { return undefined; } create() {} }
class FakeHistory implements RecommendationHistoryRepository { create() {} getById(): RecommendationHistoryEntry | undefined { return undefined; } }
class FakeAnalytics implements AnalyticsTracker { events: Array<{ event: AnalyticsEventName; payload: Record<string, unknown> | undefined }> = []; track(event: AnalyticsEventName, payload?: Record<string, never>) { this.events.push({ event, payload }); } }
class FakeCarts implements CartRepository { carts = new Map<string, import('../../contracts/commerce').Cart>(); create(cart: import('../../contracts/commerce').Cart) { this.carts.set(cart.id, structuredClone(cart)); } getById(id: string) { const value = this.carts.get(id); return value ? structuredClone(value) : undefined; } getByCustomerId(customerId: string) { const value = [...this.carts.values()].find((item) => item.customerId === customerId); return value ? structuredClone(value) : undefined; } save(cart: import('../../contracts/commerce').Cart) { this.carts.set(cart.id, structuredClone(cart)); } }
class FakeOrders implements OrderRepository { orders = new Map<string, import('../../contracts/commerce').Order>(); keys = new Map<string, string>(); create(order: import('../../contracts/commerce').Order, key: string) { if (this.keys.has(`${order.customerId}:${key}`)) throw new Error('duplicate'); this.keys.set(`${order.customerId}:${key}`, order.id); this.orders.set(order.id, structuredClone(order)); } getById(id: string) { const value = this.orders.get(id); return value ? structuredClone(value) : undefined; } getByIdempotency(customerId: string, key: string) { const id = this.keys.get(`${customerId}:${key}`); return id ? this.getById(id) : undefined; } getItems(orderId: string) { return this.getById(orderId)?.items ?? []; } }
class FakePurchases implements PurchaseRepository { purchases = new Map<string, import('../../contracts/commerce').Purchase>(); create(purchase: import('../../contracts/commerce').Purchase) { this.purchases.set(purchase.orderId, structuredClone(purchase)); } getByOrderId(orderId: string) { const value = this.purchases.get(orderId); return value ? structuredClone(value) : undefined; } }

describe('D2 commerce boundary', () => {
  it('server-derives price, merges same SKU and emits add_to_cart only after mutation', () => {
    const analytics = new FakeAnalytics(); const carts = new FakeCarts(); const service = new CartService(carts, new FakeProducts(), new FakeTeas(), new FakeCustomers(), new FakeBoxes(), new FakeHistory(), analytics);
    const cart = service.createCart(customer.id);
    service.addItem(customer.id, cart.id, { sku: product.sku, quantity: 2 });
    const updated = service.addItem(customer.id, cart.id, { sku: product.sku, quantity: 1 });
    expect(updated.items).toHaveLength(1); expect(updated.items[0].quantity).toBe(3); expect(updated.items[0].unitPrice).toEqual(product.price); expect(updated.total.amount).toBe(3897); expect(analytics.events.map((item) => item.event)).toEqual(['add_to_cart', 'add_to_cart']);
  });

  it('creates immutable order pricing snapshots and is idempotent by customer plus key', () => {
    const analytics = new FakeAnalytics(); const carts = new FakeCarts(); const orders = new FakeOrders(); const cartService = new CartService(carts, new FakeProducts(), new FakeTeas(), new FakeCustomers(), new FakeBoxes(), new FakeHistory(), analytics); const orderService = new OrderService(orders, carts, new FakeProducts(), new FakeTeas(), new FakeBoxes(), new FakeCustomers(), analytics);
    const cart = cartService.createCart(customer.id); cartService.addItem(customer.id, cart.id, { sku: product.sku, quantity: 2 });
    const shipping = { recipientName: 'Test', addressLine1: '1 Main', city: 'Uman', postalCode: '20300', countryCode: 'UA' };
    const first = orderService.createOrder(customer.id, { cartId: cart.id, shipping, idempotencyKey: 'idem-1' });
    const second = orderService.createOrder(customer.id, { cartId: cart.id, shipping, idempotencyKey: 'idem-1' });
    expect(second.id).toBe(first.id); expect(first.pricingSnapshot.subtotal.amount).toBe(2598); expect(first.pricingSnapshot.shipping.amount).toBe(0); expect(first.pricingSnapshot.total.amount).toBe(2598); expect(analytics.events.map((item) => item.event)).toContain('order_created');
  });

  it('does not expose a client purchase path and records purchase only through the internal boundary', () => {
    const analytics = new FakeAnalytics(); const orders = new FakeOrders(); const purchases = new FakePurchases(); const order: import('../../contracts/commerce').Order = { id: 'order-1', customerId: customer.id, status: 'created', items: [{ id: 'item-1', sku: product.sku, teaId: tea.id, teaName: tea.name, quantity: 1, unitPrice: product.price, lineTotal: product.price }], pricingSnapshot: { subtotal: product.price, discounts: createMoney(0, 'UAH'), shipping: createMoney(0, 'UAH'), total: product.price }, shipping: { recipientName: 'Test', addressLine1: '1 Main', city: 'Uman', postalCode: '20300', countryCode: 'UA' }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; orders.create(order, 'purchase-test'); const boundary = new PurchaseBoundaryService(purchases, orders, analytics);
    const purchase = boundary.recordAuthoritativePurchase({ orderId: order.id, customerId: customer.id, amount: product.price, confirmedAt: new Date().toISOString() });
    expect(purchase.orderId).toBe(order.id); expect(boundary.recordAuthoritativePurchase({ orderId: order.id, customerId: customer.id, amount: product.price, confirmedAt: new Date().toISOString() }).id).toBe(purchase.id); expect(analytics.events.map((item) => item.event)).toContain('purchase');
  });
});
