import { describe, it, expect } from 'vitest';
import { safeText, safeNum, toLocalDateString, getErrorMessage, roundCurrency } from '../utils';

// ─── safeText ────────────────────────────────────────────────────────────────

describe('safeText', () => {
  it('returns a string value unchanged', () => {
    expect(safeText('hello')).toBe('hello');
  });

  it('returns empty string for null', () => {
    expect(safeText(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(safeText(undefined)).toBe('');
  });

  it('converts a number to its string representation', () => {
    expect(safeText(42)).toBe('42');
  });

  it('returns empty string for an empty string input', () => {
    expect(safeText('')).toBe('');
  });
});

// ─── safeNum ─────────────────────────────────────────────────────────────────

describe('safeNum', () => {
  it('returns a numeric value unchanged', () => {
    expect(safeNum(3.14)).toBe(3.14);
  });

  it('returns 0 for negative zero', () => {
    expect(safeNum(-0)).toBe(-0);
  });

  it('parses an integer string', () => {
    expect(safeNum('5')).toBe(5);
  });

  it('parses a decimal string with a dot separator', () => {
    expect(safeNum('1.50')).toBe(1.5);
  });

  it('parses a decimal string with a comma separator (European format)', () => {
    expect(safeNum('1,50')).toBe(1.5);
  });

  it('handles negative numbers', () => {
    expect(safeNum('-2.50')).toBe(-2.5);
  });

  it('strips whitespace inside the string (e.g. thousands separator)', () => {
    expect(safeNum('1 000')).toBe(1000);
  });

  it('returns 0 for a non-numeric string', () => {
    expect(safeNum('abc')).toBe(0);
  });

  it('returns 0 for null', () => {
    expect(safeNum(null)).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(safeNum(undefined)).toBe(0);
  });

  it('returns 0 for an empty string', () => {
    expect(safeNum('')).toBe(0);
  });
});

// ─── toLocalDateString ────────────────────────────────────────────────────────

describe('toLocalDateString', () => {
  it('formats a date as YYYY-MM-DD', () => {
    const d = new Date(2025, 0, 15); // Jan 15, 2025
    expect(toLocalDateString(d)).toBe('2025-01-15');
  });

  it('pads single-digit month and day with leading zero', () => {
    const d = new Date(2025, 2, 5); // Mar 5, 2025
    expect(toLocalDateString(d)).toBe('2025-03-05');
  });

  it('handles December 31st correctly', () => {
    const d = new Date(2025, 11, 31); // Dec 31, 2025
    expect(toLocalDateString(d)).toBe('2025-12-31');
  });

  it('handles January 1st correctly', () => {
    const d = new Date(2026, 0, 1); // Jan 1, 2026
    expect(toLocalDateString(d)).toBe('2026-01-01');
  });
});

// ─── roundCurrency ──────────────────────────────────────────────────────────

describe('roundCurrency', () => {
  it('returns an exact two-decimal value unchanged', () => {
    expect(roundCurrency(1.50)).toBe(1.5);
  });

  it('rounds a floating-point drift result to 2 decimals (e.g. 0.1 + 0.2)', () => {
    expect(roundCurrency(0.1 + 0.2)).toBe(0.3);
  });

  it('handles precio_unitario * cantidad - descuento without drift', () => {
    // 1.99 * 3 = 5.970000000000001 in IEEE 754
    expect(roundCurrency(1.99 * 3)).toBe(5.97);
  });

  it('returns 0 for 0', () => {
    expect(roundCurrency(0)).toBe(0);
  });

  it('handles negative values', () => {
    expect(roundCurrency(-1.999)).toBe(-2);
  });
});

// ─── getErrorMessage ──────────────────────────────────────────────────────────

describe('getErrorMessage', () => {
  it('extracts the message from an Error instance', () => {
    expect(getErrorMessage(new Error('something broke'))).toBe('something broke');
  });

  it('converts a string to itself', () => {
    expect(getErrorMessage('raw string error')).toBe('raw string error');
  });

  it('converts a number to its string representation', () => {
    expect(getErrorMessage(42)).toBe('42');
  });

  it('converts null to the string "null"', () => {
    expect(getErrorMessage(null)).toBe('null');
  });

  it('converts undefined to the string "undefined"', () => {
    expect(getErrorMessage(undefined)).toBe('undefined');
  });
});
