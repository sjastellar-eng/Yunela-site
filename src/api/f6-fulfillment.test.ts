import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { request } from 'node:http';
import { openDatabase } from '../database/client';
import { applyMigrations } from '../database/migrate';
import { AuthenticationService } from '../application/auth';
import { CustomerService } from '../application/customer/service';
import { SqliteCustomerRepository } from '../application/sqliteRepositories';
import { createF3ApiServer } from './f3-server';
import { FulfillmentAnalyticsService } from '../application/analytics/fulfillmentService';
import type { FulfillmentApplicationService } from '../application/fulfillment/service';

const secret = 'test-secret-that-is-at-least-32-characters-long';
const period = '?from=2026-10-01T00%3A00%3A00Z&to=2026-11-01T00%3A00%3A00Z';

describe('F6.2 OPERATOR-only fulfillment analytics HTTP', () => {
  let db: ReturnType<typeof openDatabase>;
  let server: ReturnType<typeof createF3ApiServer>;
  let auth: AuthenticationService;
  beforeEach(() => {
    process.env.YUNELA_AUTH_SECRET = secret;
    db = openDatabase(); applyMigrations(db);
    auth = new AuthenticationService(db, new CustomerService(new SqliteCustomerRepository(db)), secret);
    auth.registerCustomer('customer@example.com','customer-password-123');
    auth.provisionActor('OPERATOR','operator@example.com','operator-password-123');
    auth.provisionActor('SUPPLIER','supplier@example.com','supplier-password-123');
    server = createF3ApiServer({ authService: auth, fulfillmentService: {} as FulfillmentApplicationService, fulfillmentAnalytics: new FulfillmentAnalyticsService(db, () => new Date('2026-10-10T12:00:00Z')) });
  });
  afterEach(() => { server.close(); db.close(); delete process.env.YUNELA_AUTH_SECRET; });
  async function get(path: string, token?: string): Promise<{status:number;body:Record<string,unknown>}> {
    if (!server.listening) await new Promise<void>(resolve => server.listen(0,'127.0.0.1',resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No address');
    return new Promise((resolve,reject) => {
      const req = request({hostname:'127.0.0.1',port:address.port,path,method:'GET',headers:token?{authorization:'Bearer '+token}:{}},res=>{
        const chunks:Buffer[]=[];
        res.on('data',chunk=>chunks.push(Buffer.from(chunk)));
        res.on('end',()=>resolve({status:res.statusCode??0,body:JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string,unknown>}));
      });
      req.on('error',reject);req.end();
    });
  }
  it('requires authorization and denies customer and supplier', async () => {
    expect((await get('/api/v1/analytics/fulfillment/overview'+period)).status).toBe(401);
    for (const [email,password] of [['customer@example.com','customer-password-123'],['supplier@example.com','supplier-password-123']]) {
      expect((await get('/api/v1/analytics/fulfillment/overview'+period,auth.login(email,password).accessToken)).status).toBe(403);
    }
  });
  it('allows operator to read overview and commerce without exposing PII', async () => {
    const token=auth.login('operator@example.com','operator-password-123').accessToken;
    const overview=await get('/api/v1/analytics/fulfillment/overview'+period,token);
    expect(overview.status).toBe(200);
    expect(overview.body).toMatchObject({cohort:'FULFILLMENT_CREATED',totalFulfillments:0,processingBacklog:0});
    expect(JSON.stringify(overview.body)).not.toContain('customer@example.com');
    const commerce=await get('/api/v1/analytics/fulfillment/timing'+period,token);
    expect(commerce.status).toBe(200);
    expect((commerce.body.processing as Record<string,unknown>).sampleSize).toBe(0);
  });
  it('validates dates and limit with HTTP 400', async () => {
    const token=auth.login('operator@example.com','operator-password-123').accessToken;
    expect((await get('/api/v1/analytics/fulfillment/overview?from=bad&to=bad',token)).status).toBe(400);
    expect((await get('/api/v1/analytics/fulfillment/timing'+period+'&to=bad',token)).status).toBe(400);
  });
});
