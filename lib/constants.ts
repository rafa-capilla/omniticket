/**
 * Sentinel value written in column D (Producto) to mark the total-summary row
 * of each ticket stored in the "Gastos" sheet. Used across App.tsx, SheetsService,
 * SyncEngine, and all lens/analysis components — must be identical everywhere.
 */
export const TOTAL_TICKET_MARKER = '--- TOTAL TICKET ---' as const;

/**
 * Canonical list of default category names.
 * Used by ConfigService when bootstrapping the spreadsheet and by SyncEngine
 * as a fallback when no categories have been loaded yet.
 * Keep in sync with ConfigService.DEFAULT_CATEGORIES (names only, no descriptions).
 */
export const DEFAULT_CATEGORY_NAMES = [
  'Lácteos',
  'Carne',
  'Fruta/Verdura',
  'Limpieza',
  'Bebidas',
  'Higiene',
  'Otros',
] as const;

export type DefaultCategoryName = (typeof DEFAULT_CATEGORY_NAMES)[number];
