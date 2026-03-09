/** Marker used in the "Producto" column (D) to identify the total-row of a ticket. */
export const TOTAL_TICKET_MARKER = '--- TOTAL TICKET ---' as const;

/**
 * Default category names used as fallback when no user-defined categories are
 * loaded from the spreadsheet (e.g. first sync before Categories sheet exists).
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
