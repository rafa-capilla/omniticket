/**
 * Domain error types for OmniTicket.
 * Replaces fragile string-based error codes ("401", "NOT_FOUND") with typed,
 * catchable error classes that enable safe instanceof checks.
 */

/** Thrown when the Google OAuth token has expired or been revoked (HTTP 401). */
export class AuthExpiredError extends Error {
  constructor() {
    super('Sesión expirada. Por favor, reconecta tu cuenta de Google.');
    this.name = 'AuthExpiredError';
  }
}

/** Thrown when a required resource (e.g. the OmniTicket spreadsheet) is not found. */
export class NotFoundError extends Error {
  constructor(resource: string) {
    super(`${resource} no encontrado`);
    this.name = 'NotFoundError';
  }
}

/** Thrown when a Google API returns HTTP 429 (rate limit exceeded). */
export class RateLimitError extends Error {
  constructor() {
    super('Rate limit alcanzado. Espera unos segundos e inténtalo de nuevo.');
    this.name = 'RateLimitError';
  }
}

/** Type guard: returns true if the error is an authentication expiry. */
export function isAuthError(err: unknown): err is AuthExpiredError {
  return err instanceof AuthExpiredError;
}
