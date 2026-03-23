import { RateLimitError } from '@/domain/errors';

/**
 * Reintenta una función async ante errores de rate-limit (429).
 * Usa backoff exponencial: 1s, 2s, 4s entre reintentos.
 * Otros errores se propagan inmediatamente sin reintentar.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      const isRateLimit = err instanceof RateLimitError;
      const isLastAttempt = attempt === maxAttempts - 1;

      if (isLastAttempt || !isRateLimit) throw err;

      const waitMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
      console.warn(`[withRetry] Rate limit hit, attempt ${attempt + 1}/${maxAttempts}. Retrying in ${waitMs}ms…`);
      await new Promise(r => setTimeout(r, waitMs));
    }
  }
  // TypeScript exige un return, aunque la lógica nunca llega aquí
  throw new Error('withRetry: unreachable');
}
