import { describe, it, expect } from 'vitest';
import { AuthExpiredError, NotFoundError, RateLimitError, isAuthError } from '../errors';

// ─── AuthExpiredError ────────────────────────────────────────────────────────

describe('AuthExpiredError', () => {
  it('is an instance of Error', () => {
    const err = new AuthExpiredError();
    expect(err).toBeInstanceOf(Error);
  });

  it('has name "AuthExpiredError"', () => {
    const err = new AuthExpiredError();
    expect(err.name).toBe('AuthExpiredError');
  });

  it('contains a user-facing message about session expiry', () => {
    const err = new AuthExpiredError();
    expect(err.message).toContain('expirada');
  });
});

// ─── NotFoundError ───────────────────────────────────────────────────────────

describe('NotFoundError', () => {
  it('is an instance of Error', () => {
    const err = new NotFoundError('Spreadsheet');
    expect(err).toBeInstanceOf(Error);
  });

  it('has name "NotFoundError"', () => {
    const err = new NotFoundError('Spreadsheet');
    expect(err.name).toBe('NotFoundError');
  });

  it('includes the resource name in the message', () => {
    const err = new NotFoundError('Spreadsheet');
    expect(err.message).toContain('Spreadsheet');
  });
});

// ─── RateLimitError ──────────────────────────────────────────────────────────

describe('RateLimitError', () => {
  it('is an instance of Error', () => {
    const err = new RateLimitError();
    expect(err).toBeInstanceOf(Error);
  });

  it('has name "RateLimitError"', () => {
    const err = new RateLimitError();
    expect(err.name).toBe('RateLimitError');
  });

  it('contains a user-facing message about rate limiting', () => {
    const err = new RateLimitError();
    expect(err.message).toContain('Rate limit');
  });
});

// ─── isAuthError ─────────────────────────────────────────────────────────────

describe('isAuthError', () => {
  it('returns true for AuthExpiredError instances', () => {
    expect(isAuthError(new AuthExpiredError())).toBe(true);
  });

  it('returns false for generic Error instances', () => {
    expect(isAuthError(new Error('401'))).toBe(false);
  });

  it('returns false for RateLimitError', () => {
    expect(isAuthError(new RateLimitError())).toBe(false);
  });

  it('returns false for NotFoundError', () => {
    expect(isAuthError(new NotFoundError('x'))).toBe(false);
  });

  it('returns false for null', () => {
    expect(isAuthError(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isAuthError(undefined)).toBe(false);
  });

  it('returns false for a plain string', () => {
    expect(isAuthError('AuthExpiredError')).toBe(false);
  });

  it('returns false for a plain object with matching name', () => {
    expect(isAuthError({ name: 'AuthExpiredError', message: '' })).toBe(false);
  });
});
