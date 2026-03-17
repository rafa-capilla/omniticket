import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch } from '../apiFetch';

// ─── apiFetch ─────────────────────────────────────────────────────────────────

describe('apiFetch', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the Response when status is ok', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: 'ok' }), { status: 200 })
    );

    const res = await apiFetch('https://example.com/api');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.data).toBe('ok');
  });

  it('throws Error("401") on a 401 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401 })
    );

    await expect(apiFetch('https://example.com/api')).rejects.toThrow('401');
  });

  it('throws a rate-limit error on a 429 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Too Many Requests', { status: 429 })
    );

    await expect(apiFetch('https://example.com/api')).rejects.toThrow('Rate limit');
  });

  it('extracts error.message from Google API JSON error body', async () => {
    const errorBody = { error: { message: 'Spreadsheet not found' } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(errorBody), { status: 404, statusText: 'Not Found' })
    );

    await expect(apiFetch('https://example.com/api')).rejects.toThrow('Spreadsheet not found');
  });

  it('falls back to "Error HTTP {status}" when body is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('plain text error', {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'text/plain' },
      })
    );

    await expect(apiFetch('https://example.com/api')).rejects.toThrow('Error HTTP 500');
  });

  it('falls back to "Error HTTP {status}" when JSON body lacks error.message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ unexpected: true }), { status: 403 })
    );

    await expect(apiFetch('https://example.com/api')).rejects.toThrow('Error HTTP 403');
  });

  it('forwards RequestInit options to fetch', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200 })
    );

    await apiFetch('https://example.com/api', {
      method: 'POST',
      headers: { Authorization: 'Bearer token123' },
    });

    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/api', {
      method: 'POST',
      headers: { Authorization: 'Bearer token123' },
    });
  });
});
