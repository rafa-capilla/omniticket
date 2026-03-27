import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, extractGoogleApiErrorMessage } from '../apiFetch';
import { AuthExpiredError, RateLimitError } from '@/domain/errors';

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
  });

  it('throws AuthExpiredError on 401', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Unauthorized', { status: 401 })
    );

    await expect(apiFetch('https://example.com/api')).rejects.toThrow(AuthExpiredError);
  });

  it('throws RateLimitError on 429', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Too Many Requests', { status: 429 })
    );

    await expect(apiFetch('https://example.com/api')).rejects.toThrow(RateLimitError);
  });

  it('extracts error.message from Google API JSON error body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Spreadsheet not found' } }), { status: 404 })
    );

    await expect(apiFetch('https://example.com/api')).rejects.toThrow('Spreadsheet not found');
  });

  it('falls back to generic message when body is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('plain text', { status: 500, headers: { 'Content-Type': 'text/plain' } })
    );

    await expect(apiFetch('https://example.com/api')).rejects.toThrow('Error HTTP 500');
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

describe('extractGoogleApiErrorMessage', () => {
  it('extracts error.message from standard Google API error', async () => {
    const res = new Response(JSON.stringify({ error: { message: 'Not found', code: 404 } }), { status: 404 });
    expect(await extractGoogleApiErrorMessage(res, 404)).toBe('Not found');
  });

  it('returns fallback when body has no error field', async () => {
    const res = new Response(JSON.stringify({ unexpected: true }), { status: 403 });
    expect(await extractGoogleApiErrorMessage(res, 403)).toBe('Error HTTP 403');
  });

  it('returns fallback when error is not an object', async () => {
    const res = new Response(JSON.stringify({ error: 'string' }), { status: 500 });
    expect(await extractGoogleApiErrorMessage(res, 500)).toBe('Error HTTP 500');
  });

  it('returns fallback when error.message is not a string', async () => {
    const res = new Response(JSON.stringify({ error: { message: 42 } }), { status: 400 });
    expect(await extractGoogleApiErrorMessage(res, 400)).toBe('Error HTTP 400');
  });

  it('returns fallback when body is not valid JSON', async () => {
    const res = new Response('not json', { status: 500 });
    expect(await extractGoogleApiErrorMessage(res, 500)).toBe('Error HTTP 500');
  });

  it('returns fallback when body is null JSON', async () => {
    const res = new Response('null', { status: 500 });
    expect(await extractGoogleApiErrorMessage(res, 500)).toBe('Error HTTP 500');
  });

  it('returns fallback when error field is null', async () => {
    const res = new Response(JSON.stringify({ error: null }), { status: 500 });
    expect(await extractGoogleApiErrorMessage(res, 500)).toBe('Error HTTP 500');
  });
});
