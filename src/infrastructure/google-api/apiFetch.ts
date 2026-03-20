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

/**
 * Extracts a human-readable error message from a Google API JSON error response.
 * Google APIs return errors in the shape: { error: { message: string, ... } }
 * Falls back to a generic "Error HTTP {status}" if parsing fails.
 */
export async function extractGoogleApiErrorMessage(res: Response, status: number): Promise<string> {
  const fallback = `Error HTTP ${status}`;
  try {
    const body: unknown = await res.json();
    if (body === null || typeof body !== 'object') return fallback;

    const errorField = (body as Record<string, unknown>).error;
    if (errorField === null || errorField === undefined || typeof errorField !== 'object') return fallback;

    const message = (errorField as Record<string, unknown>).message;
    return typeof message === 'string' ? message : fallback;
  } catch {
    return fallback;
  }
}
