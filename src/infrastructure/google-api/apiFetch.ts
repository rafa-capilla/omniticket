import { AuthExpiredError, RateLimitError } from '@/domain/errors';

/**
 * Wrapper sobre fetch() que verifica response.ok y lanza errores descriptivos.
 * - 401: lanza AuthExpiredError para que App.tsx dispare el flujo de re-autenticación
 * - 429: lanza RateLimitError para que withRetry() reintente con backoff
 * - otros errores HTTP: extrae el mensaje de error del body JSON de Google APIs
 */
export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, init);
  if (!res.ok) {
    if (res.status === 401) throw new AuthExpiredError();
    if (res.status === 429) throw new RateLimitError();
    const msg = await extractGoogleApiErrorMessage(res, res.status);
    throw new Error(msg);
  }
  return res;
}

/** Type guard for objects with an `error.message` shape (Google API error responses). */
function hasErrorMessage(body: unknown): body is { error: { message: string } } {
  if (body === null || typeof body !== 'object') return false;
  const maybeError = (body as { error?: unknown }).error;
  if (maybeError === null || typeof maybeError !== 'object') return false;
  return typeof (maybeError as { message?: unknown }).message === 'string';
}

/**
 * Extracts a human-readable error message from a Google API JSON error response.
 * Google APIs return errors in the shape: { error: { message: string, ... } }
 * Falls back to a generic "Error HTTP {status}" if parsing fails.
 */
export async function extractGoogleApiErrorMessage(res: Response, status: number): Promise<string> {
  const fallback = `Error HTTP ${status}`;
  try {
    const body: unknown = await res.json();
    return hasErrorMessage(body) ? body.error.message : fallback;
  } catch {
    return fallback;
  }
}
