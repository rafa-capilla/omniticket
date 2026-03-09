
export interface OmniSettings {
  GMAIL_SEARCH_LABEL: string;
  GMAIL_PROCESSED_LABEL: string;
  GEMINI_API_KEY: string;
  LAST_SYNC: string;
}

export interface SyncResult {
  messageId: string;
  status: 'success' | 'error';
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
  status: 'active' | 'inactive';
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
  period: { start: string; end: string };
  totalSpent: number;
  ticketCount: number;
  byCategory: { name: string; total: number; percentage: number }[];
  byProduct: { name: string; total: number }[];
  byStore: { name: string; total: number }[];
  lineItems: string[];
}

export type ViewState = 'LENSES' | 'HISTORY' | 'RULES' | 'CATEGORIES' | 'SETTINGS';
export type LensType = 'products' | 'categories' | 'stores' | 'analysis';

// ─── Google API response shapes ───────────────────────────────────────────────
// Minimal subsets of Google API responses actually consumed by the app.
// Typing these prevents implicit `any` on `response.json()` call-sites.

/** Google Sheets API — values.get / values.batchGet */
export interface SheetsValuesResponse {
  values?: string[][];
  range?: string;
  majorDimension?: string;
}

/** Google Sheets API — spreadsheets.get (fields=sheets.properties) */
export interface SheetsMetadataResponse {
  sheets?: Array<{
    properties?: {
      title?: string;
      sheetId?: number;
    };
  }>;
}

/** Google Drive API — files.list */
export interface DriveFilesResponse {
  files?: Array<{
    id: string;
    name: string;
  }>;
}
