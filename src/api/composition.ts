import { CustomerService } from '../application/customer/service';
import { DiscoveryBoxApplicationService } from '../application/discoveryBox/service';
import { FeedbackService } from '../application/feedback/service';
import { TeaProfileService } from '../application/profile/service';
import { DeterministicRecommendationEngine, RecommendationApplicationService } from '../application/recommendation/service';
import { TeaService } from '../application/tea/service';
import {
  SqliteCustomerRepository,
  SqliteDiscoveryBoxRepository,
  SqliteFeedbackRepository,
  SqliteRecommendationHistoryRepository,
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
  const profileRepository = new SqliteTeaProfileRepository(db);
  const feedbackRepository = new SqliteFeedbackRepository(db);
  const historyRepository = new SqliteRecommendationHistoryRepository(db);
  const discoveryBoxRepository = new SqliteDiscoveryBoxRepository(db);
  const recommendationService = new RecommendationApplicationService(
    new DeterministicRecommendationEngine(teaRepository),
    { customerRepository, historyRepository },
  );
  const dependencies: ApiDependencies = {
    teaService: new TeaService(teaRepository),
    customerService: new CustomerService(customerRepository),
    profileService: new TeaProfileService(profileRepository, customerRepository),
    feedbackService: new FeedbackService(feedbackRepository, customerRepository, teaRepository),
    recommendationService,
    discoveryBoxService: new DiscoveryBoxApplicationService({
      recommendationService,
      boxRepository: discoveryBoxRepository,
    }),
  };
  return { server: createApiServer({ dependencies }), close: () => db.close() };
}
