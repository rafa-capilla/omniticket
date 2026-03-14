/** Marker used in the "Producto" column (D) to identify the total-row of a ticket. */
export const TOTAL_TICKET_MARKER = '--- TOTAL TICKET ---' as const;

/**
 * Zero-based column indices for the Gastos sheet (A:J).
 * Matches the header: ID Ticket | Tienda | Fecha | Producto | Categoría | Cantidad | P. Unitario | Descuento | Total Línea | Producto Normalizado
 */
export const GastosCol = {
  ID:             0,
  TIENDA:         1,
  FECHA:          2,
  PRODUCTO:       3,
  CATEGORIA:      4,
  CANTIDAD:       5,
  PRECIO_UNIT:    6,
  DESCUENTO:      7,
  TOTAL_LINEA:    8,
  NOMBRE_NORM:    9,
} as const;

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
