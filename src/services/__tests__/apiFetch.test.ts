import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, extractGoogleApiErrorMessage } from '../apiFetch';
import { AuthExpiredError, RateLimitError } from '@/domain/errors';

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

  it('throws AuthExpiredError on a 401 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401 })
    );

    await expect(apiFetch('https://example.com/api')).rejects.toThrow(AuthExpiredError);
  });

  it('throws RateLimitError on a 429 response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Too Many Requests', { status: 429 })
    );

    await expect(apiFetch('https://example.com/api')).rejects.toThrow(RateLimitError);
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

// ─── extractGoogleApiErrorMessage ────────────────────────────────────────────

describe('extractGoogleApiErrorMessage', () => {
  it('extracts error.message from a standard Google API error response', async () => {
    const body = { error: { message: 'Spreadsheet not found', code: 404 } };
    const res = new Response(JSON.stringify(body), { status: 404 });

    const msg = await extractGoogleApiErrorMessage(res, 404);

    expect(msg).toBe('Spreadsheet not found');
  });

  it('returns fallback when body has no error field', async () => {
    const res = new Response(JSON.stringify({ unexpected: true }), { status: 403 });

    const msg = await extractGoogleApiErrorMessage(res, 403);

    expect(msg).toBe('Error HTTP 403');
  });

  it('returns fallback when error field is not an object', async () => {
    const res = new Response(JSON.stringify({ error: 'string error' }), { status: 500 });

    const msg = await extractGoogleApiErrorMessage(res, 500);

    expect(msg).toBe('Error HTTP 500');
  });

  it('returns fallback when error.message is not a string', async () => {
    const res = new Response(JSON.stringify({ error: { message: 42 } }), { status: 400 });

    const msg = await extractGoogleApiErrorMessage(res, 400);

    expect(msg).toBe('Error HTTP 400');
  });

  it('returns fallback when body is not valid JSON', async () => {
    const res = new Response('not json', { status: 500 });

    const msg = await extractGoogleApiErrorMessage(res, 500);

    expect(msg).toBe('Error HTTP 500');
  });

  it('returns fallback when body is null JSON', async () => {
    const res = new Response('null', { status: 500 });

    const msg = await extractGoogleApiErrorMessage(res, 500);

    expect(msg).toBe('Error HTTP 500');
  });

  it('returns fallback when error field is null', async () => {
    const res = new Response(JSON.stringify({ error: null }), { status: 500 });

    const msg = await extractGoogleApiErrorMessage(res, 500);

    expect(msg).toBe('Error HTTP 500');
  });
});
