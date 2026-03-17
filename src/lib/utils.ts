import type { Rule, Category, GastosRow } from '@/shared/types/domain';
import { DEFAULT_CATEGORY_NAMES, GastosCol } from '@/lib/constants';

export const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

/** Formats a Date as YYYY-MM-DD using local timezone (no UTC shift). */
export const toLocalDateString = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Extracts a human-readable message from an unknown caught error. */
export const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export const safeText = (val: unknown): string =>
  val === null || val === undefined ? '' : String(val);

/** Rounds a number to 2 decimal places — essential for currency arithmetic to avoid IEEE 754 drift. */
export const roundCurrency = (n: number): number => Math.round(n * 100) / 100;

export const safeNum = (val: unknown): number => {
  if (typeof val === 'number') return val;
  const clean = String(val ?? '0').replace(/\s/g, '').replace(',', '.').replace(/[^-0-9.]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

/** Builds Authorization + Content-Type headers for Google API calls. */
export const authHeaders = (token: string, contentType?: string): HeadersInit =>
  contentType
    ? { Authorization: `Bearer ${token}`, 'Content-Type': contentType }
    : { Authorization: `Bearer ${token}` };

/** Shorthand for JSON auth headers (the most common case). */
export const jsonAuthHeaders = (token: string): HeadersInit =>
  authHeaders(token, 'application/json');

/**
 * Re-throws 401 errors (auth expired), returns the fallback for everything else.
 * Consolidates the repeated catch pattern across service methods.
 */
export function catchNonAuth<T>(err: unknown, context: string, fallback: T): T {
  if (err instanceof Error && err.message === '401') throw err;
  console.error(context, err);
  return fallback;
}

/**
 * Aggregates numeric values by a string key extracted from each item.
 * Replaces the repeated Map<string, number> + forEach + set pattern.
 */
export function aggregateByKey<T>(
  items: T[],
  keyFn: (item: T) => string,
  valueFn: (item: T) => number,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    if (key) map.set(key, (map.get(key) ?? 0) + valueFn(item));
  }
  return map;
}

/**
 * Finds the first rule whose pattern matches the given product name (case-insensitive contains).
 * Single source of truth for rule matching — used by both SyncEngine (at write time)
 * and LensesView (at read time).
 */
export function matchRule(productName: string, rules: Rule[]): Rule | undefined {
  if (!productName) return undefined;
  const lower = productName.toLowerCase();
  return rules.find(r => r.pattern && lower.includes(r.pattern.toLowerCase()));
}

/**
 * Parses a raw string[] row from the Gastos sheet into a typed GastosRow.
 * Centralises the index-based access so consumers work with named fields.
 */
export function parseGastosRow(row: string[]): GastosRow {
  return {
    id:                safeText(row[GastosCol.ID]),
    tienda:            safeText(row[GastosCol.TIENDA]),
    fecha:             safeText(row[GastosCol.FECHA]),
    producto:          safeText(row[GastosCol.PRODUCTO]),
    categoria:         safeText(row[GastosCol.CATEGORIA]),
    cantidad:          safeNum(row[GastosCol.CANTIDAD]),
    precioUnitario:    safeNum(row[GastosCol.PRECIO_UNIT]),
    descuento:         safeNum(row[GastosCol.DESCUENTO]),
    totalLinea:        safeNum(row[GastosCol.TOTAL_LINEA]),
    nombreNormalizado: safeText(row[GastosCol.NOMBRE_NORM]),
  };
}

/**
 * Returns the list of active categories, falling back to the default set
 * when no active user-defined categories exist.
 * Consolidates the repeated filter-then-fallback pattern across components and services.
 */
export function getActiveCategories(categories: Category[]): Category[] {
  const active = categories.filter(c => c.status === 'active');
  return active.length > 0
    ? active
    : DEFAULT_CATEGORY_NAMES.map(name => ({ name, description: '', status: 'active' as const }));
}
