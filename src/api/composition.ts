import { CustomerService } from '../application/customer/service';
import { DiscoveryBoxApplicationService } from '../application/discoveryBox/service';
import { FeedbackService } from '../application/feedback/service';
import { TeaProfileService } from '../application/profile/service';
import { DeterministicRecommendationEngine, RecommendationApplicationService } from '../application/recommendation/service';
import { TeaService } from '../application/tea/service';
import { CartService, OrderService, PurchaseBoundaryService } from '../application/commerce/service';
import { SqliteCartRepository, SqliteCommercialProductRepository, SqliteOrderRepository, SqlitePurchaseRepository } from '../application/sqliteCommerceRepositories';
import { SqliteCustomerRepository, SqliteDiscoveryBoxRepository, SqliteFeedbackRepository, SqliteRecommendationHistoryRepository, SqliteTeaProfileRepository, SqliteTeaRepository } from '../application/sqliteRepositories';
import { SqlitePaymentAttemptRepository } from '../application/payment/sqliteRepository';
import { PaymentService } from '../application/payment/service';
import { MonoAcquiringAdapter } from '../application/payment/mono';
import { openDatabase } from '../database/client';
import { applyMigrations } from '../database/migrate';
import { createAnalyticsTracker } from '../contracts/analytics';
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
  const commercialProductRepository = new SqliteCommercialProductRepository(db);
  const cartRepository = new SqliteCartRepository(db);
  const orderRepository = new SqliteOrderRepository(db);
  const purchaseRepository = new SqlitePurchaseRepository(db);
  const paymentAttemptRepository = new SqlitePaymentAttemptRepository(db);
  const analytics = createAnalyticsTracker(() => undefined);
  const recommendationService = new RecommendationApplicationService(new DeterministicRecommendationEngine(teaRepository), { customerRepository, historyRepository });
  const mono = new MonoAcquiringAdapter({ webhookUrl: process.env.MONO_WEBHOOK_URL ?? '', redirectUrl: process.env.MONO_REDIRECT_URL });
  const paymentService = new PaymentService(paymentAttemptRepository, orderRepository, customerRepository, mono, analytics, process.env.MONO_WEBHOOK_URL ?? '', process.env.MONO_REDIRECT_URL);
  const dependencies: ApiDependencies = {
    teaService: new TeaService(teaRepository),
    customerService: new CustomerService(customerRepository),
    profileService: new TeaProfileService(profileRepository, customerRepository),
    feedbackService: new FeedbackService(feedbackRepository, customerRepository, teaRepository, profileRepository),
    recommendationService,
    discoveryBoxService: new DiscoveryBoxApplicationService({ recommendationService, boxRepository: discoveryBoxRepository }),
    commerce: {
      cartService: new CartService(cartRepository, commercialProductRepository, teaRepository, customerRepository, discoveryBoxRepository, historyRepository, analytics),
      orderService: new OrderService(orderRepository, cartRepository, commercialProductRepository, teaRepository, discoveryBoxRepository, customerRepository, analytics),
      purchaseBoundary: new PurchaseBoundaryService(purchaseRepository, orderRepository, analytics),
    },
    paymentService,
  };
  return { server: createApiServer({ dependencies }), close: () => db.close() };
}
