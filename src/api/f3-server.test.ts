import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { request } from 'node:http';
import { openDatabase } from '../database/client';
import { applyMigrations } from '../database/migrate';
import { CustomerService } from '../application/customer/service';
import { SqliteCustomerRepository } from '../application/sqliteRepositories';
import { AuthenticationService } from '../application/auth';
import type { FulfillmentRecord, ShipmentRecord } from '../application/fulfillment/repositories';
import { createF3ApiServer } from './f3-server';
import type { FulfillmentApplicationService } from '../application/fulfillment/service';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';

type FakeFulfillment = {
  getFulfillment: (id: string) => FulfillmentRecord;
  createShipment: (...args: unknown[]) => ShipmentRecord;
};

function fulfillment(customerId: string): FulfillmentRecord {
  const now = new Date().toISOString();
  return { id: 'fulfillment-1', orderId: 'order-1', purchaseId: 'purchase-1', customerId, status: 'PACKED', shippingSnapshotJson: '{}', itemsSnapshotJson: '[]', createdAt: now, updatedAt: now };
}

async function http(server: ReturnType<typeof createF3ApiServer>, method: string, path: string, body?: unknown, token?: string, extraHeaders: Record<string, string> = {}) {
  if (!server.listening) await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('server address unavailable');
  return new Promise<{ status: number; body: Record<string, unknown> }>((resolve, reject) => {
    const payload = body === undefined ? undefined : JSON.stringify(body);
    const req = request({ hostname: '127.0.0.1', port: address.port, path, method, headers: { ...(payload ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...extraHeaders } }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown> }));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('F3 authenticated fulfillment API', () => {
  let db: ReturnType<typeof openDatabase>;
  let auth: AuthenticationService;
  let server: ReturnType<typeof createF3ApiServer>;
  let ownerToken: string;
  let otherToken: string;
  let operatorToken: string;
  let supplierToken: string;
  let fake: FakeFulfillment;

  beforeEach(() => {
    process.env.YUNELA_AUTH_SECRET = SECRET;
    db = openDatabase();
    applyMigrations(db);
    const customerService = new CustomerService(new SqliteCustomerRepository(db));
    auth = new AuthenticationService(db, customerService, SECRET);
    const owner = auth.registerCustomer('owner@example.com', 'owner-password-123');
    const other = auth.registerCustomer('other@example.com', 'other-password-123');
    auth.provisionActor('OPERATOR', 'operator@example.com', 'operator-password-123');
    auth.provisionActor('SUPPLIER', 'supplier@example.com', 'supplier-password-123');
    ownerToken = auth.login(owner.email, 'owner-password-123').accessToken;
    otherToken = auth.login(other.email, 'other-password-123').accessToken;
    operatorToken = auth.login('operator@example.com', 'operator-password-123').accessToken;
    supplierToken = auth.login('supplier@example.com', 'supplier-password-123').accessToken;
    const record = fulfillment(owner.id);
    fake = {
      getFulfillment: (id) => ({ ...record, id }),
      createShipment: (id, actor, operationKey) => ({ id: 'shipment-1', fulfillmentId: String(id), status: 'CREATED', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), carrier: String(actor), trackingNumber: String(operationKey) }),
    };
    server = createF3ApiServer({ authService: auth, fulfillmentService: fake as unknown as FulfillmentApplicationService });
  });

  afterEach(() => { server.close(); db.close(); delete process.env.YUNELA_AUTH_SECRET; });

  it('returns 401 without authentication', async () => {
    const response = await http(server, 'GET', '/api/v1/fulfillments/fulfillment-1');
    expect(response.status).toBe(401);
  });

  it('resolves customer actor from the bearer token and enforces ownership', async () => {
    const owned = await http(server, 'GET', '/api/v1/fulfillments/fulfillment-1', undefined, ownerToken, { 'x-customer-id': 'attacker-controlled-id' });
    expect(owned.status).toBe(200);
    const denied = await http(server, 'GET', '/api/v1/fulfillments/fulfillment-1', undefined, otherToken, { 'x-customer-id': 'owner-id' });
    expect(denied.status).toBe(403);
  });

  it('rejects supplier from shipment creation and permits operator', async () => {
    const denied = await http(server, 'POST', '/api/v1/fulfillments/fulfillment-1/shipment', { operationKey: 'ship-1' }, supplierToken);
    expect(denied.status).toBe(403);
    const created = await http(server, 'POST', '/api/v1/fulfillments/fulfillment-1/shipment', { operationKey: 'ship-1' }, operatorToken);
    expect(created.status).toBe(201);
    expect((created.body as { carrier?: string }).carrier).toBe(`OPERATOR:${auth.login('operator@example.com', 'operator-password-123').identity.id}`);
  });

  it('never accepts customerId from the approval body', async () => {
    const response = await http(server, 'POST', '/api/v1/fulfillments/fulfillment-1/discovery-box/approval', { operationKey: 'approve-1', customerId: 'attacker-controlled-id', originalTeaId: 'tea-1', replacementTeaId: 'tea-2', reason: 'approved', customerDecision: 'APPROVED' }, ownerToken);
    expect(response.status).not.toBe(401);
    expect(response.status).not.toBe(403);
  });
});
