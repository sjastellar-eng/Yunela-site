import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { ApplicationError } from '../application/errors';
import { CustomerService } from '../application/customer/service';
import { DiscoveryBoxApplicationService } from '../application/discoveryBox/service';
import { FeedbackService } from '../application/feedback/service';
import { TeaProfileService } from '../application/profile/service';
import { RecommendationApplicationService } from '../application/recommendation/service';
import { TeaService } from '../application/tea/service';
import { CartService, OrderService, PurchaseBoundaryService } from '../application/commerce/service';
import { PaymentService } from '../application/payment/service';
import type { TeaTaxonomyReference } from '../application/repositories';
import type { Feedback, TeaProfile } from '../contracts/account';
import type { CreateOrderRequest } from '../contracts/commerce';
import type { RecommendationRequest } from '../contracts/recommendation';
import type { Tea } from '../contracts/tea';
import type { CreateTeaDto, TeaListQuery, UpdateTeaDto } from './dto';
import { applicationErrorToHttp } from './errors';

const API_PREFIX = '/api/v1';
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_PAGE_SIZE = 50;

export interface ApiDependencies {
  teaService: TeaService;
  customerService: CustomerService;
  profileService: TeaProfileService;
  feedbackService: FeedbackService;
  recommendationService: RecommendationApplicationService;
  discoveryBoxService: DiscoveryBoxApplicationService;
  commerce?: { cartService: CartService; orderService: OrderService; purchaseBoundary: PurchaseBoundaryService };
  paymentService?: PaymentService;
}
export interface ApiServerOptions { dependencies: ApiDependencies; }

function requestId(request: IncomingMessage): string { const supplied = request.headers['x-request-id']; return typeof supplied === 'string' && supplied.trim() ? supplied.trim().slice(0, 128) : randomUUID(); }
function sendJson(response: ServerResponse, status: number, body: unknown, id: string): void { const payload = JSON.stringify(body); response.statusCode = status; response.setHeader('content-type', 'application/json; charset=utf-8'); response.setHeader('x-request-id', id); response.setHeader('content-length', Buffer.byteLength(payload)); response.end(payload); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function validatePathId(value: string, name: string): string { let id: string; try { id = decodeURIComponent(value); } catch { throw new ApplicationError('VALIDATION_ERROR', `${name} is invalid`); } if (!id.trim() || id.length > 128) throw new ApplicationError('VALIDATION_ERROR', `${name} is invalid`); return id; }
function requireCustomerId(request: IncomingMessage): string { const value = request.headers['x-customer-id']; if (typeof value !== 'string' || !value.trim()) throw new ApplicationError('VALIDATION_ERROR', 'x-customer-id header is required'); return validatePathId(value, 'customerId'); }
function parsePagination(url: URL): TeaListQuery { const page = Number(url.searchParams.get('page') ?? '1'); const pageSize = Number(url.searchParams.get('pageSize') ?? '20'); if (!Number.isInteger(page) || page < 1) throw new ApplicationError('VALIDATION_ERROR', 'page must be a positive integer'); if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) throw new ApplicationError('VALIDATION_ERROR', `pageSize must be an integer between 1 and ${MAX_PAGE_SIZE}`); return { page, pageSize }; }
async function readRawBody(request: IncomingMessage): Promise<Buffer> { return new Promise((resolve, reject) => { let total = 0; const chunks: Buffer[] = []; let tooLarge = false; request.on('data', (chunk: Buffer | string) => { if (tooLarge) return; const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); total += buffer.length; if (total > MAX_BODY_BYTES) { tooLarge = true; reject(new ApplicationError('VALIDATION_ERROR', 'Request body is too large')); request.resume(); return; } chunks.push(buffer); }); request.on('end', () => { if (!tooLarge) resolve(Buffer.concat(chunks)); }); request.on('error', reject); }); }
async function readJson(request: IncomingMessage): Promise<unknown> { const contentType = request.headers['content-type'] ?? ''; if (!contentType.toLowerCase().startsWith('application/json')) throw new ApplicationError('VALIDATION_ERROR', 'Content-Type must be application/json'); const raw = await readRawBody(request); if (!raw.toString('utf8').trim()) throw new ApplicationError('VALIDATION_ERROR', 'Request body is required'); try { return JSON.parse(raw.toString('utf8')); } catch { throw new ApplicationError('VALIDATION_ERROR', 'Malformed JSON'); } }
function requireObject(value: unknown): Record<string, unknown> { if (!isRecord(value)) throw new ApplicationError('VALIDATION_ERROR', 'Request body must be a JSON object'); return value; }
function rejectInventory(value: Record<string, unknown>): void { if (Object.prototype.hasOwnProperty.call(value, 'inventory')) throw new ApplicationError('VALIDATION_ERROR', 'inventory is read-only and cannot be supplied to Tea create/update'); }
function mapTeaWrite(value: unknown): CreateTeaDto | UpdateTeaDto { const body = requireObject(value); rejectInventory(body); const taxonomyValue = requireObject(body.taxonomy); if (typeof taxonomyValue.familyId !== 'string' || !taxonomyValue.familyId.trim()) throw new ApplicationError('VALIDATION_ERROR', 'taxonomy.familyId is required'); if (taxonomyValue.subfamilyId !== undefined && typeof taxonomyValue.subfamilyId !== 'string') throw new ApplicationError('VALIDATION_ERROR', 'taxonomy.subfamilyId must be a string'); if (taxonomyValue.styleId !== undefined && typeof taxonomyValue.styleId !== 'string') throw new ApplicationError('VALIDATION_ERROR', 'taxonomy.styleId must be a string'); const { taxonomy: ignoredTaxonomy, ...tea } = body; void ignoredTaxonomy; return { ...(tea as unknown as Tea), taxonomy: taxonomyValue as unknown as TeaTaxonomyReference } as CreateTeaDto; }
function mapProfile(value: unknown, customerId: string): TeaProfile { const body = requireObject(value) as unknown as TeaProfile; if (body.customerId !== customerId) throw new ApplicationError('VALIDATION_ERROR', 'profile.customerId must match the URL customer id'); return body; }
function mapFeedback(value: unknown): Feedback { return requireObject(value) as unknown as Feedback; }
function mapRecommendation(value: unknown): RecommendationRequest { return requireObject(value) as unknown as RecommendationRequest; }
function mapCartItem(value: unknown): { sku: string; quantity: number; recommendationHistoryId?: string; discoveryBoxId?: string } { const body = requireObject(value); if (typeof body.sku !== 'string' || !body.sku.trim()) throw new ApplicationError('VALIDATION_ERROR', 'sku is required'); if (typeof body.quantity !== 'number') throw new ApplicationError('VALIDATION_ERROR', 'quantity must be a number'); if (body.recommendationHistoryId !== undefined && typeof body.recommendationHistoryId !== 'string') throw new ApplicationError('VALIDATION_ERROR', 'recommendationHistoryId must be a string'); if (body.discoveryBoxId !== undefined && typeof body.discoveryBoxId !== 'string') throw new ApplicationError('VALIDATION_ERROR', 'discoveryBoxId must be a string'); return { sku: body.sku, quantity: body.quantity, ...(body.recommendationHistoryId ? { recommendationHistoryId: body.recommendationHistoryId } : {}), ...(body.discoveryBoxId ? { discoveryBoxId: body.discoveryBoxId } : {}) }; }
function mapOrderRequest(value: unknown): CreateOrderRequest { const body = requireObject(value); if (typeof body.cartId !== 'string' || !body.cartId.trim()) throw new ApplicationError('VALIDATION_ERROR', 'cartId is required'); if (typeof body.idempotencyKey !== 'string' || !body.idempotencyKey.trim()) throw new ApplicationError('VALIDATION_ERROR', 'idempotencyKey is required'); const shipping = requireObject(body.shipping) as unknown as CreateOrderRequest['shipping']; return { cartId: body.cartId, shipping, idempotencyKey: body.idempotencyKey }; }
function methodNotAllowed(response: ServerResponse, id: string, allow: string): void { response.setHeader('allow', allow); sendJson(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed', requestId: id } }, id); }
function requireDependency<T>(value: T | undefined, name: string): T { if (!value) throw new ApplicationError('NOT_IMPLEMENTED', `${name} is not configured`); return value; }

async function route(request: IncomingMessage, response: ServerResponse, dependencies: ApiDependencies, id: string): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname === '/health') { if (request.method !== 'GET') return methodNotAllowed(response, id, 'GET'); return sendJson(response, 200, { status: 'ok', service: 'yunela-api', version: 'v1' }, id); }
  if (!url.pathname.startsWith(API_PREFIX)) return sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found', requestId: id } }, id);
  const path = url.pathname.slice(API_PREFIX.length).replace(/\/$/, '') || '/';

  if (path === '/teas') { if (request.method === 'GET') { const pagination = parsePagination(url); const all = dependencies.teaService.listTeas(); const start = (pagination.page - 1) * pagination.pageSize; const items = all.slice(start, start + pagination.pageSize); return sendJson(response, 200, { items, ...pagination, total: all.length, hasNextPage: start + items.length < all.length }, id); } if (request.method === 'POST') return sendJson(response, 201, dependencies.teaService.createTea(mapTeaWrite(await readJson(request)) as CreateTeaDto, (mapTeaWrite(await Promise.resolve({} as unknown)) as CreateTeaDto).taxonomy), id); return methodNotAllowed(response, id, 'GET, POST'); }
  const teaMatch = path.match(/^\/teas\/([^/]+)$/); if (teaMatch) { const teaId = validatePathId(teaMatch[1], 'teaId'); if (request.method === 'GET') return sendJson(response, 200, dependencies.teaService.getTeaById(teaId), id); if (request.method === 'PATCH') { const body = mapTeaWrite(await readJson(request)) as UpdateTeaDto; if (body.id !== teaId) throw new ApplicationError('VALIDATION_ERROR', 'tea.id must match the URL tea id'); return sendJson(response, 200, dependencies.teaService.updateTea(body, body.taxonomy), id); } return methodNotAllowed(response, id, 'GET, PATCH'); }
  if (path === '/customers') { if (request.method === 'POST') { const created = dependencies.customerService.createAnonymousCustomer(); return sendJson(response, 201, { customerId: created.id }, id); } return methodNotAllowed(response, id, 'POST'); }
  const customerMatch = path.match(/^\/customers\/([^/]+)$/); if (customerMatch) { const customerId = validatePathId(customerMatch[1], 'customerId'); if (request.method === 'GET') return sendJson(response, 200, dependencies.customerService.getCustomer(customerId), id); return methodNotAllowed(response, id, 'GET'); }
  const profileMatch = path.match(/^\/customers\/([^/]+)\/profile$/); if (profileMatch) { const customerId = validatePathId(profileMatch[1], 'customerId'); if (request.method === 'GET') return sendJson(response, 200, dependencies.profileService.getTeaProfile(customerId), id); if (request.method === 'POST') return sendJson(response, 201, dependencies.profileService.createTeaProfile(mapProfile(await readJson(request), customerId)), id); if (request.method === 'PATCH') return sendJson(response, 200, dependencies.profileService.updateTeaProfile(mapProfile(await readJson(request), customerId)), id); return methodNotAllowed(response, id, 'GET, POST, PATCH'); }
  if (path === '/feedback') { if (request.method === 'POST') return sendJson(response, 201, dependencies.feedbackService.submitFeedback(mapFeedback(await readJson(request))), id); return methodNotAllowed(response, id, 'POST'); }
  if (path === '/recommendations') { if (request.method === 'POST') return sendJson(response, 200, await dependencies.recommendationService.recommend(mapRecommendation(await readJson(request))), id); return methodNotAllowed(response, id, 'POST'); }
  if (path === '/discovery-boxes') { if (request.method === 'POST') return sendJson(response, 201, await dependencies.discoveryBoxService.createBox(mapRecommendation(await readJson(request))), id); return methodNotAllowed(response, id, 'POST'); }
  const discoveryBoxMatch = path.match(/^\/discovery-boxes\/([^/]+)$/); if (discoveryBoxMatch) { const boxId = validatePathId(discoveryBoxMatch[1], 'discoveryBoxId'); if (request.method === 'GET') return sendJson(response, 200, await dependencies.discoveryBoxService.getBox(boxId), id); return methodNotAllowed(response, id, 'GET'); }

  if (path === '/payments/mono/webhook') {
    if (request.method !== 'POST') return methodNotAllowed(response, id, 'POST');
    const rawBody = await readRawBody(request);
    const signature = request.headers['x-sign'];
    if (typeof signature !== 'string' || !signature) throw new ApplicationError('VALIDATION_ERROR', 'x-sign header is required');
    const result = await requireDependency(dependencies.paymentService, 'PaymentService').handleMonoWebhook(rawBody, signature);
    return sendJson(response, 200, result, id);
  }

  if (dependencies.commerce) {
    const customerId = requireCustomerId(request);
    if (path === '/carts') { if (request.method === 'POST') return sendJson(response, 201, dependencies.commerce.cartService.createCart(customerId), id); return methodNotAllowed(response, id, 'POST'); }
    const cartMatch = path.match(/^\/carts\/([^/]+)$/); if (cartMatch) { const cartId = validatePathId(cartMatch[1], 'cartId'); if (request.method === 'GET') return sendJson(response, 200, dependencies.commerce.cartService.getCart(customerId, cartId), id); return methodNotAllowed(response, id, 'GET'); }
    const cartItemMatch = path.match(/^\/carts\/([^/]+)\/items\/([^/]+)$/); if (cartItemMatch) { const cartId = validatePathId(cartItemMatch[1], 'cartId'); const sku = validatePathId(cartItemMatch[2], 'sku'); if (request.method === 'PATCH') { const body = requireObject(await readJson(request)); if (typeof body.quantity !== 'number') throw new ApplicationError('VALIDATION_ERROR', 'quantity is required'); return sendJson(response, 200, dependencies.commerce.cartService.updateItem(customerId, cartId, sku, body.quantity), id); } if (request.method === 'DELETE') return sendJson(response, 200, dependencies.commerce.cartService.removeItem(customerId, cartId, sku), id); return methodNotAllowed(response, id, 'PATCH, DELETE'); }
    const cartItemsMatch = path.match(/^\/carts\/([^/]+)\/items$/); if (cartItemsMatch) { const cartId = validatePathId(cartItemsMatch[1], 'cartId'); if (request.method === 'POST') return sendJson(response, 200, dependencies.commerce.cartService.addItem(customerId, cartId, mapCartItem(await readJson(request))), id); return methodNotAllowed(response, id, 'POST'); }
    if (path === '/orders') { if (request.method === 'POST') return sendJson(response, 201, dependencies.commerce.orderService.createOrder(customerId, mapOrderRequest(await readJson(request))), id); return methodNotAllowed(response, id, 'POST'); }
    const orderPaymentMatch = path.match(/^\/orders\/([^/]+)\/payment-attempts$/); if (orderPaymentMatch) { const orderId = validatePathId(orderPaymentMatch[1], 'orderId'); if (request.method === 'POST') { const key = request.headers['idempotency-key']; if (typeof key !== 'string' || !key.trim()) throw new ApplicationError('VALIDATION_ERROR', 'Idempotency-Key header is required'); return sendJson(response, 201, await requireDependency(dependencies.paymentService, 'PaymentService').createPaymentAttempt(customerId, orderId, key), id); } return methodNotAllowed(response, id, 'POST'); }
    const orderMatch = path.match(/^\/orders\/([^/]+)$/); if (orderMatch) { const orderId = validatePathId(orderMatch[1], 'orderId'); if (request.method === 'GET') return sendJson(response, 200, dependencies.commerce.orderService.getOrder(customerId, orderId), id); return methodNotAllowed(response, id, 'GET'); }
  }
  if (dependencies.paymentService) {
    const paymentMatch = path.match(/^\/payment-attempts\/([^/]+)$/); if (paymentMatch) { const customerId = requireCustomerId(request); const paymentAttemptId = validatePathId(paymentMatch[1], 'paymentAttemptId'); if (request.method === 'GET') return sendJson(response, 200, dependencies.paymentService.getPaymentAttempt(customerId, paymentAttemptId), id); return methodNotAllowed(response, id, 'GET'); }
  }
  return sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found', requestId: id } }, id);
}

export function createApiServer(options: ApiServerOptions): Server { return createServer((request, response) => { const id = requestId(request); route(request, response, options.dependencies, id).catch((error: unknown) => { if (response.headersSent) { response.destroy(); return; } const mapped = applicationErrorToHttp(error, id); sendJson(response, mapped.status, mapped.body, id); }); }); }
