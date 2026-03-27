/**
 * Domain types for OmniTicket.
 * Pure domain concepts — no infrastructure dependencies.
 */

/** Value object representing an inclusive date range (YYYY-MM-DD boundaries). */
export interface DateRange {
  start: string;
  end: string;
}

export type CategoryStatus = 'active' | 'inactive';

export type SettingKey = 'GMAIL_SEARCH_LABEL' | 'GMAIL_PROCESSED_LABEL' | 'GEMINI_API_KEY' | 'LAST_SYNC';

export interface OmniSettings {
  GMAIL_SEARCH_LABEL: string;
  GMAIL_PROCESSED_LABEL: string;
  GEMINI_API_KEY: string;
  LAST_SYNC: string;
}

export type SyncStatus = 'success' | 'error';

export interface SyncResult {
  messageId: string;
  status: SyncStatus;
  error?: string;
}

export interface TicketItem {
  nombre: string;
  nombre_normalizado?: string;
  categoria: string;
  precio_unitario: number;
  cantidad: number;
  descuento: number;
  precio_total_linea: number;
}

export interface TicketData {
  id: string;
  tienda: string;
  fecha: string;
  items: TicketItem[];
  total_ticket: number;
}

export interface HistoryTicket {
  id: string;
  tienda: string;
  fecha: string;
  total: number;
}

export interface Rule {
  pattern: string;
  normalized: string;
  category: string;
}

export interface Category {
  name: string;
  description: string;
  status: CategoryStatus;
}

export interface DashboardStats {
  totalSpent: number;
  avgTicket: number;
  topCategory: string;
  ticketCount: number;
}

export interface AIAnalysisResult {
  analysis_text: string;
  chart_type: 'pie' | 'bar';
  chart_data: { name: string; value: number }[];
  chart_title: string;
}

export interface AggregatedData {
  period: DateRange;
  totalSpent: number;
  ticketCount: number;
  byCategory: { name: string; total: number; percentage: number }[];
  byProduct: { name: string; total: number }[];
  byStore: { name: string; total: number }[];
  lineItems: string[];
}

/**
 * Typed representation of a single row from the Gastos sheet (A:J).
 * Replaces fragile index-based access with named, typed fields.
 */
export interface GastosRow {
  id: string;
  tienda: string;
  fecha: string;
  producto: string;
  categoria: string;
  cantidad: number;
  precioUnitario: number;
  descuento: number;
  totalLinea: number;
  nombreNormalizado: string;
}

export type ViewState = 'LENSES' | 'HISTORY' | 'RULES' | 'CATEGORIES' | 'SETTINGS';
export type LensType = 'products' | 'categories' | 'stores' | 'analysis';
