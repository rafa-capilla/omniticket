/** Marker used in the "Producto" column (D) to identify the total-row of a ticket. */
export const TOTAL_TICKET_MARKER = '--- TOTAL TICKET ---' as const;

/** Displayed when no category has any spend (e.g. KPI "top category" with no data). */
export const NO_CATEGORY_LABEL = 'Ninguna' as const;

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
 * Spreadsheet column letter for the Categoría column in the Gastos sheet.
 * Derived from GastosCol.CATEGORIA (0-based index 4 → 'E').
 * Used by SheetsCategoryRepo.updateCategoryInGastos for range-based updates.
 */
export const GASTOS_CATEGORIA_COL_LETTER = String.fromCharCode(65 + GastosCol.CATEGORIA) as 'E';

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

// ─── Sheet Row Indexing ─────────────────────────────────────────────────────

/**
 * Offset to convert a 0-based array index to a 1-based Sheets row number
 * that accounts for the header row. Index 0 in the data array corresponds
 * to row 2 in the sheet (row 1 is the header).
 */
export const SHEET_HEADER_OFFSET = 2;

// ─── Timing ──────────────────────────────────────────────────────────────────

/** Delay in ms between processing tickets after a failure (prevents tight error loops). */
export const SYNC_ERROR_DELAY_MS = 500;

/** Interval in ms for checking whether the OAuth token needs a silent refresh. */
export const TOKEN_REFRESH_CHECK_INTERVAL_MS = 60_000;

// ─── AI Model ────────────────────────────────────────────────────────────────

/** Gemini model identifier — single source of truth for all AI calls. */
export const GEMINI_MODEL = 'gemini-2.5-pro' as const;

// ─── API Base URLs ────────────────────────────────────────────────────────────

export const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets' as const;
export const DRIVE_API = 'https://www.googleapis.com/drive/v3/files' as const;
export const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me' as const;

// ─── Sheet Names ──────────────────────────────────────────────────────────────

export const SheetName = {
  SETTINGS:   'Settings',
  GASTOS:     'Gastos',
  RULES:      'Rules',
  CATEGORIES: 'Categories',
} as const;
