import { AuthenticationService } from '../application/auth';
import { CustomerService } from '../application/customer/service';
import { FulfillmentApplicationService } from '../application/fulfillment/service';
import { SqliteFulfillmentMutationRepository } from '../application/fulfillment/sqliteDomainRepository';
import { SqliteCustomerRepository } from '../application/sqliteRepositories';
import { openDatabase } from '../database/client';
import { applyMigrations } from '../database/migrate';
import { createF3ApiServer } from './f3-server';\nimport { createAnalyticsTracker } from '../contracts/analytics';

export function createDefaultF3ApiServer(databaseFile = process.env.YUNELA_DB_FILE ?? ':memory:'): { server: ReturnType<typeof createF3ApiServer>; close: () => void } {
  const db = openDatabase(databaseFile);
  applyMigrations(db);
  const customerService = new CustomerService(new SqliteCustomerRepository(db));
  const authService = new AuthenticationService(db, customerService);
  const analytics = createAnalyticsTracker(() => undefined);\n  const fulfillmentService = new FulfillmentApplicationService(new SqliteFulfillmentMutationRepository(db), analytics);

  if (process.env.YUNELA_OPERATOR_EMAIL && process.env.YUNELA_OPERATOR_PASSWORD) {
    provisionIfMissing(authService, 'OPERATOR', process.env.YUNELA_OPERATOR_EMAIL, process.env.YUNELA_OPERATOR_PASSWORD);
  }
  if (process.env.YUNELA_SUPPLIER_EMAIL && process.env.YUNELA_SUPPLIER_PASSWORD) {
    provisionIfMissing(authService, 'SUPPLIER', process.env.YUNELA_SUPPLIER_EMAIL, process.env.YUNELA_SUPPLIER_PASSWORD);
  }

  return { server: createF3ApiServer({ authService, fulfillmentService }), close: () => db.close() };
}

function provisionIfMissing(auth: AuthenticationService, type: 'OPERATOR' | 'SUPPLIER', email: string, password: string): void {
  try { auth.provisionActor(type, email, password); } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('already exists')) throw error;
  }
}
