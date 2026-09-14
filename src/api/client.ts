import type { Customer, Feedback, TeaProfile } from '../contracts/account';
import type { RecommendationRequest, RecommendationResult } from '../contracts/recommendation';
import type { Tea } from '../contracts/tea';

interface ApiErrorBody {
  error?: { code?: string; message?: string; requestId?: string };
}

export interface PaginatedTeaResponse {
  items: Tea[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
}

export interface DiscoveryBoxItem {
  teaId: string;
  classification: 'MATCH' | 'STRETCH' | 'WILDCARD';
  position: number;
  score: number;
  reasons: string[];
}

export interface DiscoveryBox {
  id: string;
  customerId?: string;
  algorithmVersion: string;
  selectionVersion: string;
  profileReference: RecommendationRequest['profileReference'];
  items: DiscoveryBoxItem[];
  createdAt: string;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const API_PREFIX = `${API_BASE}/api/v1`;

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_PREFIX}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    let payload: ApiErrorBody = {};
    try { payload = await response.json() as ApiErrorBody; } catch { /* keep generic error */ }
    throw new ApiClientError(
      payload.error?.message ?? `Request failed (${response.status})`,
      response.status,
      payload.error?.code,
      payload.error?.requestId,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  createAnonymousCustomer: () => request<{ customerId: string }>('/customers', { method: 'POST' }),
  getCustomer: (customerId: string) => request<Customer>(`/customers/${encodeURIComponent(customerId)}`),
  listTeas: (page = 1, pageSize = 50) => request<PaginatedTeaResponse>(`/teas?page=${page}&pageSize=${pageSize}`),
  getTea: (teaId: string) => request<Tea>(`/teas/${encodeURIComponent(teaId)}`),
  getProfile: (customerId: string) => request<TeaProfile>(`/customers/${encodeURIComponent(customerId)}/profile`),
  createProfile: (profile: TeaProfile) => request<TeaProfile>(`/customers/${encodeURIComponent(profile.customerId)}/profile`, {
    method: 'POST',
    body: JSON.stringify(profile),
  }),
  recommend: (input: RecommendationRequest) => request<RecommendationResult[]>('/recommendations', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  createDiscoveryBox: (input: RecommendationRequest) => request<DiscoveryBox>('/discovery-boxes', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
  getDiscoveryBox: (boxId: string) => request<DiscoveryBox>(`/discovery-boxes/${encodeURIComponent(boxId)}`),
  submitFeedback: (feedback: Feedback) => request<Feedback>('/feedback', {
    method: 'POST',
    body: JSON.stringify(feedback),
  }),
};
