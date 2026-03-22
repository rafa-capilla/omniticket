import { describe, it, expect } from 'vitest';
import { safeText, safeNum, toLocalDateString, getErrorMessage, roundCurrency, catchNonAuth, aggregateByKey, matchRule, getActiveCategories, parseGastosRow } from '../utils';
import type { Rule, Category } from '@/shared/types/domain';
import { AuthExpiredError } from '@/domain/errors';

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

// ─── catchNonAuth ────────────────────────────────────────────────────────────

describe('catchNonAuth', () => {
  it('re-throws AuthExpiredError', () => {
    const err = new AuthExpiredError();
    expect(() => catchNonAuth(err, 'test', [])).toThrow(AuthExpiredError);
  });

  it('returns fallback for non-401 Error', () => {
    const err = new Error('something else');
    const result = catchNonAuth(err, 'test', 'fallback');
    expect(result).toBe('fallback');
  });

  it('returns fallback for non-Error thrown values', () => {
    const result = catchNonAuth('string error', 'test', 42);
    expect(result).toBe(42);
  });

  it('returns the typed fallback (array)', () => {
    const err = new Error('network');
    const result = catchNonAuth(err, 'ctx', [] as string[]);
    expect(result).toEqual([]);
  });

  it('returns null fallback', () => {
    const err = new Error('network');
    const result = catchNonAuth(err, 'ctx', null);
    expect(result).toBeNull();
  });
});

// ─── aggregateByKey ──────────────────────────────────────────────────────────

describe('aggregateByKey', () => {
  it('aggregates values by key', () => {
    const items = [
      { cat: 'A', val: 10 },
      { cat: 'B', val: 20 },
      { cat: 'A', val: 5 },
    ];
    const result = aggregateByKey(items, i => i.cat, i => i.val);
    expect(result.get('A')).toBe(15);
    expect(result.get('B')).toBe(20);
  });

  it('returns empty map for empty input', () => {
    const result = aggregateByKey([], () => 'x', () => 1);
    expect(result.size).toBe(0);
  });

  it('skips items with empty string key', () => {
    const items = [
      { cat: '', val: 10 },
      { cat: 'A', val: 5 },
    ];
    const result = aggregateByKey(items, i => i.cat, i => i.val);
    expect(result.has('')).toBe(false);
    expect(result.get('A')).toBe(5);
  });

  it('handles single-item input', () => {
    const items = [{ cat: 'X', val: 42 }];
    const result = aggregateByKey(items, i => i.cat, i => i.val);
    expect(result.get('X')).toBe(42);
    expect(result.size).toBe(1);
  });
});

// ─── matchRule ────────────────────────────────────────────────────────────────

describe('matchRule', () => {
  const rules: Rule[] = [
    { pattern: 'agua con gas', normalized: 'Agua con Gas', category: 'Bebidas' },
    { pattern: 'leche', normalized: 'Leche', category: 'Lácteos' },
  ];

  it('matches case-insensitively (contains)', () => {
    const result = matchRule('AGUA CON GAS FONT VELLA 1.5L', rules);
    expect(result).toEqual(rules[0]);
  });

  it('returns the first matching rule', () => {
    const result = matchRule('leche entera', rules);
    expect(result).toEqual(rules[1]);
  });

  it('returns undefined when no rule matches', () => {
    const result = matchRule('pan de molde', rules);
    expect(result).toBeUndefined();
  });

  it('returns undefined for empty product name', () => {
    const result = matchRule('', rules);
    expect(result).toBeUndefined();
  });

  it('returns undefined for empty rules array', () => {
    const result = matchRule('leche', []);
    expect(result).toBeUndefined();
  });

  it('skips rules with empty pattern', () => {
    const rulesWithEmpty: Rule[] = [
      { pattern: '', normalized: 'Empty', category: 'Otros' },
      { pattern: 'leche', normalized: 'Leche', category: 'Lácteos' },
    ];
    const result = matchRule('leche entera', rulesWithEmpty);
    expect(result).toEqual(rulesWithEmpty[1]);
  });
});

// ─── getActiveCategories ─────────────────────────────────────────────────────

describe('getActiveCategories', () => {
  it('returns only active categories', () => {
    const cats: Category[] = [
      { name: 'Bebidas', description: '', status: 'active' },
      { name: 'Old', description: '', status: 'inactive' },
      { name: 'Otros', description: '', status: 'active' },
    ];
    const result = getActiveCategories(cats);
    expect(result).toHaveLength(2);
    expect(result.map(c => c.name)).toEqual(['Bebidas', 'Otros']);
  });

  it('falls back to default categories when none are active', () => {
    const cats: Category[] = [
      { name: 'Old', description: '', status: 'inactive' },
    ];
    const result = getActiveCategories(cats);
    expect(result.length).toBe(7);
    expect(result[0]!.name).toBe('Lácteos');
    expect(result.every(c => c.status === 'active')).toBe(true);
  });

  it('falls back to defaults for empty array', () => {
    const result = getActiveCategories([]);
    expect(result.length).toBe(7);
    expect(result[0]!.name).toBe('Lácteos');
  });

  it('returns all categories when all are active', () => {
    const cats: Category[] = [
      { name: 'A', description: 'desc', status: 'active' },
      { name: 'B', description: '', status: 'active' },
    ];
    const result = getActiveCategories(cats);
    expect(result).toEqual(cats);
  });
});

// ─── parseGastosRow ─────────────────────────────────────────────────────────

describe('parseGastosRow', () => {
  it('parses a complete 10-column row into typed GastosRow', () => {
    const row = ['uuid-1', 'Mercadona', '2025-01-15', 'LECHE ENTERA 1L', 'Lácteos', '2', '1.05', '0', '2.10', 'Leche Entera'];
    const result = parseGastosRow(row);

    expect(result).toEqual({
      id: 'uuid-1',
      tienda: 'Mercadona',
      fecha: '2025-01-15',
      producto: 'LECHE ENTERA 1L',
      categoria: 'Lácteos',
      cantidad: 2,
      precioUnitario: 1.05,
      descuento: 0,
      totalLinea: 2.10,
      nombreNormalizado: 'Leche Entera',
    });
  });

  it('handles a short row (fewer than 10 columns) gracefully', () => {
    const row = ['uuid-2', 'Lidl', '2025-03-01'];
    const result = parseGastosRow(row);

    expect(result.id).toBe('uuid-2');
    expect(result.tienda).toBe('Lidl');
    expect(result.fecha).toBe('2025-03-01');
    expect(result.producto).toBe('');
    expect(result.categoria).toBe('');
    expect(result.cantidad).toBe(0);
    expect(result.precioUnitario).toBe(0);
    expect(result.descuento).toBe(0);
    expect(result.totalLinea).toBe(0);
    expect(result.nombreNormalizado).toBe('');
  });

  it('handles an empty row', () => {
    const result = parseGastosRow([]);

    expect(result.id).toBe('');
    expect(result.tienda).toBe('');
    expect(result.totalLinea).toBe(0);
  });

  it('converts European-format numbers (comma decimal)', () => {
    const row = ['id', 'Tienda', '2025-01-01', 'Prod', 'Cat', '1', '2,50', '0,10', '2,40', 'Prod Norm'];
    const result = parseGastosRow(row);

    expect(result.precioUnitario).toBe(2.5);
    expect(result.descuento).toBe(0.1);
    expect(result.totalLinea).toBe(2.4);
  });

  it('correctly parses a TOTAL_TICKET_MARKER row', () => {
    const row = ['uuid-1', 'Mercadona', '2025-01-15', '--- TOTAL TICKET ---', '', '', '', '', '25.50', ''];
    const result = parseGastosRow(row);

    expect(result.producto).toBe('--- TOTAL TICKET ---');
    expect(result.totalLinea).toBe(25.5);
    expect(result.categoria).toBe('');
    expect(result.cantidad).toBe(0);
  });
});
