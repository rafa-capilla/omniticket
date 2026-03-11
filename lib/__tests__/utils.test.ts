import { describe, it, expect } from 'vitest';
import { safeText, safeNum } from '../utils';

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
