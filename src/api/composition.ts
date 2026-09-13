import { CustomerService } from '../application/customer/service';
import { FeedbackService } from '../application/feedback/service';
import { TeaProfileService } from '../application/profile/service';
import { NotConfiguredRecommendationEngine, RecommendationApplicationService } from '../application/recommendation/service';
import { TeaService } from '../application/tea/service';
import {
  SqliteCustomerRepository,
  SqliteFeedbackRepository,
  SqliteTeaProfileRepository,
  SqliteTeaRepository,
} from '../application/sqliteRepositories';
import { openDatabase } from '../database/client';
import { applyMigrations } from '../database/migrate';
import { createApiServer, type ApiDependencies } from './server';

export function createDefaultApiServer(databaseFile = process.env.YUNELA_DB_FILE ?? ':memory:'): { server: ReturnType<typeof createApiServer>; close: () => void } {
  const db = openDatabase(databaseFile);
  applyMigrations(db);
  const teaRepository = new SqliteTeaRepository(db);
  const customerRepository = new SqliteCustomerRepository(db);
  const dependencies: ApiDependencies = {
    teaService: new TeaService(teaRepository),
    customerService: new CustomerService(customerRepository),
    profileService: new TeaProfileService(new SqliteTeaProfileRepository(db), customerRepository),
    feedbackService: new FeedbackService(new SqliteFeedbackRepository(db), customerRepository, teaRepository),
    recommendationService: new RecommendationApplicationService(new NotConfiguredRecommendationEngine()),
  };
  return { server: createApiServer({ dependencies }), close: () => db.close() };
}
