import { OmniSettings } from '../types';
import { apiFetch } from './apiFetch';

const DEFAULT_CATEGORIES = [
  ['Lácteos', 'Leche, yogures, quesos, mantequilla, nata', 'active'],
  ['Carne', 'Carne roja, pollo, pescado, embutidos', 'active'],
  ['Fruta/Verdura', 'Frutas frescas, verduras, hortalizas, legumbres frescas', 'active'],
  ['Limpieza', 'Productos de limpieza del hogar, detergentes, lejía', 'active'],
  ['Bebidas', 'Agua, refrescos, zumos, alcohol, café, té', 'active'],
  ['Higiene', 'Productos de higiene personal: jabón, champú, pasta de dientes', 'active'],
  ['Otros', 'Todo lo que no encaje en otras categorías', 'active'],
];

/**
 * Servicio de gestión de configuración persistente en Google Sheets.
 */
export class ConfigService {
  private static readonly FILENAME = 'OmniTicket_DB';
  private spreadsheetId: string | null = null;

  constructor(private accessToken: string) {}

  async getOrFindId(): Promise<string> {
    if (this.spreadsheetId) return this.spreadsheetId;
    const q = encodeURIComponent(`name = '${ConfigService.FILENAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`);
    // apiFetch ya lanza Error("401") en respuestas 401
    const response = await apiFetch(`https://www.googleapis.com/drive/v3/files?q=${q}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    const data = await response.json();
    const fileId = data.files?.[0]?.id;
    if (!fileId) throw new Error("NOT_FOUND");
    this.spreadsheetId = String(fileId || '');
    return this.spreadsheetId;
  }

  /**
   * Asegura que la base de datos (spreadsheet) existe, está inicializada
   * y tiene las migraciones aplicadas (hoja Categories, col J en Gastos).
   */
  async ensureDatabase(): Promise<{ settings: OmniSettings, dbId: string }> {
    let id: string;
    try {
      id = await this.getOrFindId();
    } catch (e: any) {
      if (e.message === "401") throw e;

      const spreadsheet = {
        properties: { title: ConfigService.FILENAME },
        sheets: [
          { properties: { title: 'Settings' } },
          { properties: { title: 'Gastos', gridProperties: { frozenRowCount: 1 } } },
          { properties: { title: 'Rules', gridProperties: { frozenRowCount: 1 } } },
          { properties: { title: 'Mapping_Cache' } }
        ]
      };
      const response = await apiFetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(spreadsheet)
      });
      const data = await response.json();
      id = String(data.spreadsheetId || '');
      this.spreadsheetId = id;

      await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valueInputOption: 'RAW',
          data: [
            { range: 'Settings!A1:B4', values: [
                ['GMAIL_SEARCH_LABEL', 'OmniTicket'],
                ['GMAIL_PROCESSED_LABEL', 'OmniTicket/Procesado'],
                ['GEMINI_API_KEY', ''],
                ['LAST_SYNC', 'Nunca']
            ]},
            { range: 'Gastos!A1:J1', values: [['ID Ticket', 'Tienda', 'Fecha', 'Producto', 'Categoría', 'Cantidad', 'P. Unitario', 'Descuento', 'Total Línea', 'Producto Normalizado']] },
            { range: 'Rules!A1:C1', values: [['Original_Pattern', 'Normalized_Name', 'Category']] }
          ]
        })
      });
    }

    await this.runMigrations(id);
    const settings = await this.getSettings(id);
    return { settings, dbId: id };
  }

  /**
   * Aplica migraciones idempotentes al spreadsheet existente:
   * - Crea hoja "Categories" si no existe y la rellena con los 7 defaults
   * - Escribe header "Producto Normalizado" en Gastos!J1 si está vacío
   */
  private async runMigrations(spreadsheetId: string): Promise<void> {
    try {
      const metaResponse = await apiFetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
      const meta = await metaResponse.json();
      const sheetTitles: string[] = (meta.sheets || []).map((s: any) => String(s.properties?.title || ''));

      // Migration 1: Create Categories sheet
      if (!sheetTitles.includes('Categories')) {
        await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{ addSheet: { properties: { title: 'Categories', gridProperties: { frozenRowCount: 1 } } } }]
          })
        });

        await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            valueInputOption: 'RAW',
            data: [
              { range: 'Categories!A1:C1', values: [['Name', 'Description', 'Status']] },
              { range: `Categories!A2:C${DEFAULT_CATEGORIES.length + 1}`, values: DEFAULT_CATEGORIES }
            ]
          })
        });
      }

      // Migration 2: Add "Producto Normalizado" header to Gastos!J1
      const headerResponse = await apiFetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Gastos!J1`,
        { headers: { Authorization: `Bearer ${this.accessToken}` } }
      );
      const headerData = await headerResponse.json();
      if (!headerData.values || !headerData.values[0]?.[0]) {
        await apiFetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Gastos!J1?valueInputOption=RAW`,
          {
            method: 'PUT',
            headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ values: [['Producto Normalizado']] })
          }
        );
      }
    } catch (e) {
      console.error("Error en runMigrations:", e);
      // Non-fatal: don't block app startup
    }
  }

  async getSettings(forcedId?: string): Promise<OmniSettings> {
    const id = forcedId || await this.getOrFindId();
    const response = await apiFetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/Settings!A1:B5`, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    const data = await response.json();
    const rows = data.values || [];
    const settings: OmniSettings = { GMAIL_SEARCH_LABEL: 'OmniTicket', GMAIL_PROCESSED_LABEL: 'OmniTicket/Procesado', GEMINI_API_KEY: '', LAST_SYNC: 'Nunca' };

    rows.forEach((row: any[]) => {
      const key = String(row[0] || '').trim();
      const val = String(row[1] || '').trim();
      if (key === 'GMAIL_SEARCH_LABEL') settings.GMAIL_SEARCH_LABEL = val;
      if (key === 'GMAIL_PROCESSED_LABEL') settings.GMAIL_PROCESSED_LABEL = val;
      if (key === 'GEMINI_API_KEY') settings.GEMINI_API_KEY = val;
      if (key === 'LAST_SYNC') settings.LAST_SYNC = val;
    });
    return settings;
  }

  async updateSetting(key: 'GEMINI_API_KEY' | 'GMAIL_SEARCH_LABEL' | 'GMAIL_PROCESSED_LABEL', value: string): Promise<void> {
    const id = await this.getOrFindId();
    const rowMap: Record<string, number> = {
      GMAIL_SEARCH_LABEL: 1,
      GMAIL_PROCESSED_LABEL: 2,
      GEMINI_API_KEY: 3,
    };
    const row = rowMap[key];
    if (!row) return;
    await apiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/Settings!B${row}?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[String(value).trim()]] })
      }
    );
  }

  async updateGeminiKey(key: string): Promise<void> {
    return this.updateSetting('GEMINI_API_KEY', key);
  }

  async updateLastSync(): Promise<void> {
    const id = await this.getOrFindId();
    const now = new Date().toLocaleString();
    await apiFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/Settings!B4?valueInputOption=RAW`,
      {
        method: 'PUT',
        headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: [[String(now)]] })
      }
    );
  }
}
