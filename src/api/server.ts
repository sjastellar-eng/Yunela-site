import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { ApplicationError } from '../application/errors';
import { CustomerService } from '../application/customer/service';
import { FeedbackService } from '../application/feedback/service';
import { TeaProfileService } from '../application/profile/service';
import { RecommendationApplicationService } from '../application/recommendation/service';
import { TeaService } from '../application/tea/service';
import type { TeaTaxonomyReference } from '../application/repositories';
import type { Customer, Feedback, TeaProfile } from '../contracts/account';
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
}

export interface ApiServerOptions {
  dependencies: ApiDependencies;
}

function requestId(request: IncomingMessage): string {
  const supplied = request.headers['x-request-id'];
  return typeof supplied === 'string' && supplied.trim() ? supplied.trim().slice(0, 128) : randomUUID();
}

function sendJson(response: ServerResponse, status: number, body: unknown, id: string): void {
  const payload = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.setHeader('x-request-id', id);
  response.setHeader('content-length', Buffer.byteLength(payload));
  response.end(payload);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validatePathId(value: string, name: string): string {
  let id: string;
  try {
    id = decodeURIComponent(value);
  } catch {
    throw new ApplicationError('VALIDATION_ERROR', `${name} is invalid`);
  }
  if (!id.trim() || id.length > 128) throw new ApplicationError('VALIDATION_ERROR', `${name} is invalid`);
  return id;
}

function parsePagination(url: URL): TeaListQuery {
  const page = Number(url.searchParams.get('page') ?? '1');
  const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
  if (!Number.isInteger(page) || page < 1) throw new ApplicationError('VALIDATION_ERROR', 'page must be a positive integer');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
    throw new ApplicationError('VALIDATION_ERROR', `pageSize must be an integer between 1 and ${MAX_PAGE_SIZE}`);
  }
  return { page, pageSize };
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const contentType = request.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new ApplicationError('VALIDATION_ERROR', 'Content-Type must be application/json');
  }

  return new Promise((resolve, reject) => {
    let total = 0;
    const chunks: Buffer[] = [];
    let tooLarge = false;
    request.on('data', (chunk: Buffer | string) => {
      if (tooLarge) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > MAX_BODY_BYTES) {
        tooLarge = true;
        reject(new ApplicationError('VALIDATION_ERROR', 'Request body is too large'));
        request.resume();
        return;
      }
      chunks.push(buffer);
    });
    request.on('end', () => {
      if (tooLarge) return;
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        if (!text.trim()) throw new ApplicationError('VALIDATION_ERROR', 'Request body is required');
        resolve(JSON.parse(text));
      } catch (error) {
        reject(error instanceof SyntaxError ? new ApplicationError('VALIDATION_ERROR', 'Malformed JSON') : error);
      }
    });
    request.on('error', reject);
  });
}

function requireObject(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new ApplicationError('VALIDATION_ERROR', 'Request body must be a JSON object');
  return value;
}

function rejectInventory(value: Record<string, unknown>): void {
  if (Object.prototype.hasOwnProperty.call(value, 'inventory')) {
    throw new ApplicationError('VALIDATION_ERROR', 'inventory is read-only and cannot be supplied to Tea create/update');
  }
}

function mapTeaWrite(value: unknown): CreateTeaDto | UpdateTeaDto {
  const body = requireObject(value);
  rejectInventory(body);
  const taxonomy = requireObject(body.taxonomy);
  if (typeof taxonomy.familyId !== 'string' || !taxonomy.familyId.trim()) {
    throw new ApplicationError('VALIDATION_ERROR', 'taxonomy.familyId is required');
  }
  if (taxonomy.subfamilyId !== undefined && typeof taxonomy.subfamilyId !== 'string') {
    throw new ApplicationError('VALIDATION_ERROR', 'taxonomy.subfamilyId must be a string');
  }
  if (taxonomy.styleId !== undefined && typeof taxonomy.styleId !== 'string') {
    throw new ApplicationError('VALIDATION_ERROR', 'taxonomy.styleId must be a string');
  }
  const { taxonomy: _taxonomy, ...tea } = body;
  return { ...(tea as unknown as Tea), taxonomy: taxonomy as TeaTaxonomyReference } as CreateTeaDto;
}

function mapProfile(value: unknown, customerId: string): TeaProfile {
  const body = requireObject(value) as unknown as TeaProfile;
  if (body.customerId !== customerId) throw new ApplicationError('VALIDATION_ERROR', 'profile.customerId must match the URL customer id');
  return body;
}

function mapFeedback(value: unknown): Feedback {
  return requireObject(value) as unknown as Feedback;
}

function mapRecommendation(value: unknown): RecommendationRequest {
  return requireObject(value) as unknown as RecommendationRequest;
}

function methodNotAllowed(response: ServerResponse, id: string, allow: string): void {
  response.setHeader('allow', allow);
  sendJson(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed', requestId: id } }, id);
}

async function route(request: IncomingMessage, response: ServerResponse, dependencies: ApiDependencies, id: string): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname === '/health') {
    if (request.method !== 'GET') return methodNotAllowed(response, id, 'GET');
    return sendJson(response, 200, { status: 'ok', service: 'yunela-api', version: 'v1' }, id);
  }

  if (!url.pathname.startsWith(API_PREFIX)) return sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found', requestId: id } }, id);

  const path = url.pathname.slice(API_PREFIX.length).replace(/\/$/, '') || '/';
  if (path === '/teas') {
    if (request.method === 'GET') {
      const pagination = parsePagination(url);
      const all = dependencies.teaService.listTeas();
      const start = (pagination.page - 1) * pagination.pageSize;
      const items = all.slice(start, start + pagination.pageSize);
      return sendJson(response, 200, { items, ...pagination, total: all.length, hasNextPage: start + items.length < all.length }, id);
    }
    if (request.method === 'POST') {
      const body = mapTeaWrite(await readJson(request));
      const created = dependencies.teaService.createTea(body, body.taxonomy);
      return sendJson(response, 201, created, id);
    }
    return methodNotAllowed(response, id, 'GET, POST');
  }

  const teaMatch = path.match(/^\/teas\/([^/]+)$/);
  if (teaMatch) {
    const teaId = validatePathId(teaMatch[1], 'teaId');
    if (request.method === 'GET') return sendJson(response, 200, dependencies.teaService.getTeaById(teaId), id);
    if (request.method === 'PATCH') {
      const body = mapTeaWrite(await readJson(request)) as UpdateTeaDto;
      if (body.id !== teaId) throw new ApplicationError('VALIDATION_ERROR', 'tea.id must match the URL tea id');
      return sendJson(response, 200, dependencies.teaService.updateTea(body, body.taxonomy), id);
    }
    return methodNotAllowed(response, id, 'GET, PATCH');
  }

  const customerMatch = path.match(/^\/customers\/([^/]+)$/);
  if (customerMatch) {
    const customerId = validatePathId(customerMatch[1], 'customerId');
    if (request.method === 'GET') return sendJson(response, 200, dependencies.customerService.getCustomer(customerId), id);
    return methodNotAllowed(response, id, 'GET');
  }

  const profileMatch = path.match(/^\/customers\/([^/]+)\/profile$/);
  if (profileMatch) {
    const customerId = validatePathId(profileMatch[1], 'customerId');
    if (request.method === 'GET') return sendJson(response, 200, dependencies.profileService.getTeaProfile(customerId), id);
    if (request.method === 'POST') return sendJson(response, 201, dependencies.profileService.createTeaProfile(mapProfile(await readJson(request), customerId)), id);
    if (request.method === 'PATCH') return sendJson(response, 200, dependencies.profileService.updateTeaProfile(mapProfile(await readJson(request), customerId)), id);
    return methodNotAllowed(response, id, 'GET, POST, PATCH');
  }

  if (path === '/feedback') {
    if (request.method === 'POST') return sendJson(response, 201, dependencies.feedbackService.submitFeedback(mapFeedback(await readJson(request))), id);
    return methodNotAllowed(response, id, 'POST');
  }

  if (path === '/recommendations') {
    if (request.method === 'POST') return sendJson(response, 200, await dependencies.recommendationService.recommend(mapRecommendation(await readJson(request))), id);
    return methodNotAllowed(response, id, 'POST');
  }

  return sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found', requestId: id } }, id);
}

export function createApiServer(options: ApiServerOptions): Server {
  return createServer((request, response) => {
    const id = requestId(request);
    route(request, response, options.dependencies, id).catch((error: unknown) => {
      if (response.headersSent) {
        response.destroy();
        return;
      }
      const mapped = applicationErrorToHttp(error, id);
      sendJson(response, mapped.status, mapped.body, id);
    });
  });
}
