import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import type Database from 'better-sqlite3';
import { ApplicationError } from './errors';
import { CustomerService } from './customer/service';
import { validateCustomerEmail } from './validation';

export type ActorType = 'CUSTOMER' | 'OPERATOR' | 'SUPPLIER' | 'SYSTEM';
export interface Actor { type: ActorType; id: string; }
export interface AuthenticatedIdentity extends Actor { email: string; }

const TOKEN_TTL_SECONDS = 60 * 60;
const PASSWORD_MIN_LENGTH = 12;

type StoredIdentity = { id: string; actorType: Exclude<ActorType, 'SYSTEM'>; subjectId: string | null; email: string; passwordHash: string; passwordSalt: string };

function base64url(value: string | Buffer): string { return Buffer.from(value).toString('base64url'); }
function unbase64url(value: string): Buffer { return Buffer.from(value, 'base64url'); }

export class AuthenticationService {
  constructor(private readonly db: Database.Database, private readonly customerService: CustomerService, private readonly secret = process.env.YUNELA_AUTH_SECRET ?? '') {
    if (this.secret.length < 32) throw new ApplicationError('PERSISTENCE_ERROR', 'YUNELA_AUTH_SECRET must contain at least 32 characters');
  }

  registerCustomer(email: string, password: string): AuthenticatedIdentity {
    validateCustomerEmail(email);
    this.assertPassword(password);
    const normalizedEmail = email.trim().toLowerCase();
    if (this.findByEmail(normalizedEmail)) throw new ApplicationError('CONFLICT', 'An account with this email already exists');
    const customer = this.customerService.createCustomer({ id: randomUUID(), email: normalizedEmail, createdAt: new Date().toISOString() });
    this.createIdentity('CUSTOMER', customer.id, normalizedEmail, password);
    return { type: 'CUSTOMER', id: customer.id, email: normalizedEmail };
  }

  provisionActor(type: 'OPERATOR' | 'SUPPLIER', email: string, password: string, subjectId = `${type.toLowerCase()}:${email.trim().toLowerCase()}`): AuthenticatedIdentity {
    validateCustomerEmail(email);
    this.assertPassword(password);
    const normalizedEmail = email.trim().toLowerCase();
    if (this.findByEmail(normalizedEmail)) throw new ApplicationError('CONFLICT', 'An account with this email already exists');
    this.createIdentity(type, subjectId, normalizedEmail, password);
    return { type, id: subjectId, email: normalizedEmail };
  }

  login(email: string, password: string): { accessToken: string; identity: AuthenticatedIdentity; expiresIn: number } {
    const normalizedEmail = email.trim().toLowerCase();
    const identity = this.findByEmail(normalizedEmail);
    if (!identity || !this.verifyPassword(password, identity.passwordHash, identity.passwordSalt)) throw new ApplicationError('INVALID_CREDENTIALS', 'Invalid email or password');
    const actor: AuthenticatedIdentity = { type: identity.actorType, id: identity.subjectId ?? identity.id, email: identity.email };
    return { accessToken: this.issueToken(actor), identity: actor, expiresIn: TOKEN_TTL_SECONDS };
  }

  authenticate(requestHeader: string | undefined): AuthenticatedIdentity {
    if (!requestHeader?.startsWith('Bearer ')) throw new ApplicationError('AUTHENTICATION_REQUIRED', 'Bearer authentication is required');
    const token = requestHeader.slice('Bearer '.length).trim();
    if (!token) throw new ApplicationError('AUTHENTICATION_REQUIRED', 'Bearer authentication is required');
    return this.verifyToken(token);
  }

  private issueToken(identity: AuthenticatedIdentity): string {
    if (identity.type === 'SYSTEM') throw new ApplicationError('FORBIDDEN', 'SYSTEM cannot authenticate through public HTTP');
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'YUNELA' }));
    const payload = base64url(JSON.stringify({ sub: identity.id, actorType: identity.type, email: identity.email, iat: now, exp: now + TOKEN_TTL_SECONDS, jti: randomUUID() }));
    return `${header}.${payload}.${this.sign(`${header}.${payload}`)}`;
  }

  private verifyToken(token: string): AuthenticatedIdentity {
    const parts = token.split('.');
    if (parts.length !== 3) throw new ApplicationError('AUTHENTICATION_REQUIRED', 'Invalid access token');
    const [header, payload, signature] = parts;
    const expected = this.sign(`${header}.${payload}`);
    const supplied = unbase64url(signature);
    const expectedBytes = unbase64url(expected);
    if (supplied.length !== expectedBytes.length || !timingSafeEqual(supplied, expectedBytes)) throw new ApplicationError('AUTHENTICATION_REQUIRED', 'Invalid access token');
    let claims: { sub?: unknown; actorType?: unknown; email?: unknown; exp?: unknown };
    try { claims = JSON.parse(unbase64url(payload).toString('utf8')) as typeof claims; } catch { throw new ApplicationError('AUTHENTICATION_REQUIRED', 'Invalid access token'); }
    if (typeof claims.sub !== 'string' || typeof claims.email !== 'string' || !['CUSTOMER', 'OPERATOR', 'SUPPLIER'].includes(String(claims.actorType)) || typeof claims.exp !== 'number' || claims.exp <= Math.floor(Date.now() / 1000)) throw new ApplicationError('AUTHENTICATION_REQUIRED', 'Invalid or expired access token');
    const identity = this.findById(claims.sub);
    if (!identity || identity.email !== claims.email || identity.actorType !== claims.actorType) throw new ApplicationError('AUTHENTICATION_REQUIRED', 'Access token identity is no longer valid');
    return { type: identity.actorType, id: identity.subjectId ?? identity.id, email: identity.email };
  }

  private sign(value: string): string { return base64url(createHmac('sha256', this.secret).update(value).digest()); }
  private assertPassword(password: string): void { if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) throw new ApplicationError('VALIDATION_ERROR', `password must contain at least ${PASSWORD_MIN_LENGTH} characters`); }
  private hashPassword(password: string, salt: Buffer): string { return scryptSync(password, salt, 32).toString('base64url'); }
  private verifyPassword(password: string, hash: string, salt: string): boolean { const expected = Buffer.from(hash, 'base64url'); const actual = scryptSync(password, Buffer.from(salt, 'base64url'), 32); return expected.length === actual.length && timingSafeEqual(expected, actual); }

  private createIdentity(actorType: Exclude<ActorType, 'SYSTEM'>, subjectId: string | null, email: string, password: string): void {
    const salt = randomBytes(16);
    this.db.prepare(`INSERT INTO auth_identities (id, actor_type, subject_id, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(randomUUID(), actorType, subjectId, email, this.hashPassword(password, salt), salt.toString('base64url'), new Date().toISOString());
  }
  private findByEmail(email: string): StoredIdentity | undefined { return this.db.prepare(`SELECT id, actor_type AS actorType, subject_id AS subjectId, email, password_hash AS passwordHash, password_salt AS passwordSalt FROM auth_identities WHERE email = ?`).get(email) as StoredIdentity | undefined; }
  private findById(subjectId: string): StoredIdentity | undefined { return this.db.prepare(`SELECT id, actor_type AS actorType, subject_id AS subjectId, email, password_hash AS passwordHash, password_salt AS passwordSalt FROM auth_identities WHERE subject_id = ? OR id = ?`).get(subjectId, subjectId) as StoredIdentity | undefined; }
}
