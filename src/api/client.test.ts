import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, api } from './client';

afterEach(() => vi.restoreAllMocks());

describe('frontend API client', () => {
  it('creates an anonymous customer through the approved endpoint', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ customerId: 'server-id' }), { status: 201, headers: { 'content-type': 'application/json' } }));
    await expect(api.createAnonymousCustomer()).resolves.toEqual({ customerId: 'server-id' });
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/customers', expect.objectContaining({ method: 'POST' }));
  });

  it('uses the server customer id for customer-scoped profile reads', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ customerId: 'server-id', purchasedTeaIds: [], likedTeaIds: [], dislikedTeaIds: [], tastePreferences: {}, feedbackIds: [], recommendationIds: [], updatedAt: '2026-09-14T00:00:00.000Z' }), { status: 200, headers: { 'content-type': 'application/json' } }));
    await api.getProfile('server-id');
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/customers/server-id/profile', expect.objectContaining({ method: undefined }));
  });

  it('sends recommendation requests without calculating score or classification client-side', async () => {
    const response = [{ tea: { id: 'tea-1', slug: 'tea-1', name: 'Tea 1' }, classification: 'MATCH', score: 91, reasons: ['Strong taste fit'], algorithmVersion: 'recommendation-v1', profileReference: { body: 50 }, createdAt: '2026-09-14T00:00:00.000Z' }];
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(response), { status: 200, headers: { 'content-type': 'application/json' } }));
    const input = { customerId: 'server-id', profileReference: { body: 50 } };
    await expect(api.recommend(input)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/recommendations', expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }));
  });

  it('maps structured API errors into ApiClientError', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Tea not found', requestId: 'req-1' } }), { status: 404, headers: { 'content-type': 'application/json' } }));
    await expect(api.getTea('missing')).rejects.toMatchObject<ApiClientError>({ status: 404, code: 'NOT_FOUND', requestId: 'req-1', message: 'Tea not found' });
  });
});
