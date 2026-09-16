import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { AuthenticationService, type Actor } from '../application/auth';
import { ApplicationError } from '../application/errors';
import { FulfillmentApplicationService, type ReplacementApproval, type DiscoveryBoxShortage } from '../application/fulfillment/service';
import type { ShipmentStatus } from '../domain/fulfillment';
import { applicationErrorToHttp } from './errors';

const API_PREFIX = '/api/v1';
const MAX_BODY_BYTES = 1024 * 1024;

type Dependencies = { authService: AuthenticationService; fulfillmentService: FulfillmentApplicationService };

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
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new ApplicationError('VALIDATION_ERROR', 'Request body must be a JSON object');
  return value as Record<string, unknown>;
}
async function readJson(request: IncomingMessage): Promise<Record<string, unknown>> {
  const contentType = request.headers['content-type'] ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) throw new ApplicationError('VALIDATION_ERROR', 'Content-Type must be application/json');
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > MAX_BODY_BYTES) throw new ApplicationError('VALIDATION_ERROR', 'Request body is too large');
    chunks.push(buffer);
  }
  if (!chunks.length) throw new ApplicationError('VALIDATION_ERROR', 'Request body is required');
  try { return record(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch (error) { if (error instanceof ApplicationError) throw error; throw new ApplicationError('VALIDATION_ERROR', 'Malformed JSON'); }
}
function pathId(value: string, name: string): string {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { throw new ApplicationError('VALIDATION_ERROR', `${name} is invalid`); }
  if (!decoded.trim() || decoded.length > 128) throw new ApplicationError('VALIDATION_ERROR', `${name} is invalid`);
  return decoded;
}
function requireAuth(request: IncomingMessage, authService: AuthenticationService): Actor {
  return authService.authenticate(request.headers.authorization);
}
function requireType(actor: Actor, ...types: Actor['type'][]): void {
  if (!types.includes(actor.type)) throw new ApplicationError('FORBIDDEN', 'Actor is not permitted to perform this operation');
}
function requireCustomerOwner(actor: Actor, customerId: string): void {
  requireType(actor, 'CUSTOMER');
  if (actor.id !== customerId) throw new ApplicationError('FORBIDDEN', 'Customer does not own this Fulfillment');
}
function bodyString(body: Record<string, unknown>, key: string): string {
  if (typeof body[key] !== 'string' || !String(body[key]).trim()) throw new ApplicationError('VALIDATION_ERROR', `${key} is required`);
  return String(body[key]);
}
function optionalString(body: Record<string, unknown>, key: string): string | undefined {
  if (body[key] === undefined) return undefined;
  if (typeof body[key] !== 'string') throw new ApplicationError('VALIDATION_ERROR', `${key} must be a string`);
  return String(body[key]);
}

async function route(request: IncomingMessage, response: ServerResponse, dependencies: Dependencies, id: string): Promise<void> {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (url.pathname === '/health') return sendJson(response, request.method === 'GET' ? 200 : 405, { status: 'ok', service: 'yunela-fulfillment-api', version: 'v1' }, id);
  if (!url.pathname.startsWith(API_PREFIX)) return sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found', requestId: id } }, id);
  const path = url.pathname.slice(API_PREFIX.length).replace(/\/$/, '') || '/';

  if (path === '/auth/register' && request.method === 'POST') {
    const body = await readJson(request);
    const password = bodyString(body, 'password');
    const identity = dependencies.authService.registerCustomer(bodyString(body, 'email'), password);
    return sendJson(response, 201, { ...dependencies.authService.login(identity.email, password), identity }, id);
  }
  if (path === '/auth/login' && request.method === 'POST') {
    const body = await readJson(request);
    return sendJson(response, 200, dependencies.authService.login(bodyString(body, 'email'), bodyString(body, 'password')), id);
  }

  const actor = requireAuth(request, dependencies.authService);
  const fulfillmentMatch = path.match(/^\/fulfillments\/([^/]+)$/);
  if (fulfillmentMatch && request.method === 'GET') {
    const fulfillment = dependencies.fulfillmentService.getFulfillment(pathId(fulfillmentMatch[1], 'fulfillmentId'));
    if (actor.type === 'CUSTOMER') requireCustomerOwner(actor, fulfillment.customerId);
    else requireType(actor, 'OPERATOR');
    return sendJson(response, 200, fulfillment, id);
  }

  if (path === '/fulfillments' && request.method === 'POST') {
    requireType(actor, 'OPERATOR');
    const body = await readJson(request);
    return sendJson(response, 201, dependencies.fulfillmentService.createFulfillmentFromPurchase(bodyString(body, 'purchaseId'), optionalString(body, 'operationKey')), id);
  }

  const actionMatch = path.match(/^\/fulfillments\/([^/]+)\/(ready|packing|packed|failed|lost|cancel|return)$/);
  if (actionMatch && request.method === 'POST') {
    requireType(actor, 'OPERATOR');
    const fulfillmentId = pathId(actionMatch[1], 'fulfillmentId');
    const body = await readJson(request);
    const operationKey = bodyString(body, 'operationKey');
    switch (actionMatch[2]) {
      case 'ready': return sendJson(response, 200, dependencies.fulfillmentService.markReady(fulfillmentId, `OPERATOR:${actor.id}`, operationKey), id);
      case 'packing': return sendJson(response, 200, dependencies.fulfillmentService.startPacking(fulfillmentId, `OPERATOR:${actor.id}`, operationKey), id);
      case 'packed': return sendJson(response, 200, dependencies.fulfillmentService.markPacked(fulfillmentId, `OPERATOR:${actor.id}`, operationKey), id);
      case 'failed': return sendJson(response, 200, dependencies.fulfillmentService.markFailed(fulfillmentId, `OPERATOR:${actor.id}`, bodyString(body, 'reason'), operationKey), id);
      case 'lost': return sendJson(response, 200, dependencies.fulfillmentService.markLost(fulfillmentId, `OPERATOR:${actor.id}`, bodyString(body, 'reason'), operationKey), id);
      case 'cancel': return sendJson(response, 200, dependencies.fulfillmentService.cancelFulfillment(fulfillmentId, `OPERATOR:${actor.id}`, bodyString(body, 'reason'), operationKey), id);
      case 'return': return sendJson(response, 200, dependencies.fulfillmentService.recordReturn(fulfillmentId, `OPERATOR:${actor.id}`, bodyString(body, 'reason'), operationKey), id);
    }
  }

  const shipmentCreateMatch = path.match(/^\/fulfillments\/([^/]+)\/shipment$/);
  if (shipmentCreateMatch && request.method === 'POST') {
    requireType(actor, 'OPERATOR');
    const body = await readJson(request);
    return sendJson(response, 201, dependencies.fulfillmentService.createShipment(pathId(shipmentCreateMatch[1], 'fulfillmentId'), `OPERATOR:${actor.id}`, bodyString(body, 'operationKey'), { carrier: optionalString(body, 'carrier'), trackingNumber: optionalString(body, 'trackingNumber'), trackingUrl: optionalString(body, 'trackingUrl') }), id);
  }
  const shipmentActionMatch = path.match(/^\/fulfillments\/([^/]+)\/shipment\/(shipped|delivered|failed|lost|returned)$/);
  if (shipmentActionMatch && request.method === 'POST') {
    requireType(actor, 'OPERATOR');
    const body = await readJson(request);
    const fulfillmentId = pathId(shipmentActionMatch[1], 'fulfillmentId');
    const status = shipmentActionMatch[2].toUpperCase() as ShipmentStatus;
    if (status === 'FAILED' || status === 'LOST' || status === 'RETURNED') return sendJson(response, 200, dependencies.fulfillmentService.transitionShipment(fulfillmentId, status, `OPERATOR:${actor.id}`, bodyString(body, 'operationKey')), id);
    return sendJson(response, 200, status === 'SHIPPED' ? dependencies.fulfillmentService.markShipped(fulfillmentId, `OPERATOR:${actor.id}`, bodyString(body, 'operationKey')) : dependencies.fulfillmentService.markDelivered(fulfillmentId, `OPERATOR:${actor.id}`, bodyString(body, 'operationKey')), id);
  }

  const shortageMatch = path.match(/^\/fulfillments\/([^/]+)\/discovery-box\/shortage$/);
  if (shortageMatch && request.method === 'POST') {
    requireType(actor, 'OPERATOR');
    const body = await readJson(request);
    const shortage: DiscoveryBoxShortage = {
      originalTeaId: bodyString(body, 'originalTeaId'), originalLotId: optionalString(body, 'originalLotId'),
      proposedReplacementTeaId: bodyString(body, 'proposedReplacementTeaId'), proposedReplacementLotId: optionalString(body, 'proposedReplacementLotId'), reason: bodyString(body, 'reason'),
    };
    return sendJson(response, 200, dependencies.fulfillmentService.handleDiscoveryBoxShortage(pathId(shortageMatch[1], 'fulfillmentId'), shortage, `OPERATOR:${actor.id}`, bodyString(body, 'operationKey')), id);
  }
  const approvalMatch = path.match(/^\/fulfillments\/([^/]+)\/discovery-box\/approval$/);
  if (approvalMatch && request.method === 'POST') {
    const fulfillmentId = pathId(approvalMatch[1], 'fulfillmentId');
    const fulfillment = dependencies.fulfillmentService.getFulfillment(fulfillmentId);
    requireCustomerOwner(actor, fulfillment.customerId);
    const body = await readJson(request);
    const approval: ReplacementApproval = {
      originalTeaId: bodyString(body, 'originalTeaId'), originalLotId: optionalString(body, 'originalLotId'), replacementTeaId: bodyString(body, 'replacementTeaId'), replacementLotId: optionalString(body, 'replacementLotId'), reason: bodyString(body, 'reason'),
      actor: `CUSTOMER:${actor.id}`, customerDecision: bodyString(body, 'customerDecision') as ReplacementApproval['customerDecision'], timestamp: new Date().toISOString(),
    };
    if (!['APPROVED', 'REJECTED'].includes(approval.customerDecision)) throw new ApplicationError('VALIDATION_ERROR', 'customerDecision must be APPROVED or REJECTED');
    return sendJson(response, 200, dependencies.fulfillmentService.recordCustomerApproval(fulfillmentId, approval, bodyString(body, 'operationKey')), id);
  }

  return sendJson(response, 404, { error: { code: 'NOT_FOUND', message: 'Route not found', requestId: id } }, id);
}

export function createF3ApiServer(dependencies: Dependencies): Server {
  return createServer((request, response) => {
    const id = requestId(request);
    route(request, response, dependencies, id).catch((error) => {
      const mapped = applicationErrorToHttp(error, id);
      sendJson(response, mapped.status, mapped.body, id);
    });
  });
}
