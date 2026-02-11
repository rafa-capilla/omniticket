
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

export interface ProductMapping {
  original: string;
  simplificado: string;
}

export interface Rule {
  pattern: string;
  normalized: string;
  category: string;
}

export interface DashboardStats {
  totalSpent: number;
  avgTicket: number;
  topCategory: string;
  ticketCount: number;
}

export type ViewState = 'LENSES' | 'HISTORY' | 'RULES' | 'SETTINGS';
export type LensType = 'products' | 'categories' | 'stores';
