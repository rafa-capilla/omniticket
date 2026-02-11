
import { OmniSettings } from '../types';

export class ConfigService {
  private static readonly FILENAME = 'OmniTicket_DB';
  private spreadsheetId: string | null = null;

  constructor(private accessToken: string) {}

  async getOrFindId(): Promise<string> {
    if (this.spreadsheetId) return this.spreadsheetId;
    const q = encodeURIComponent(`name = '${ConfigService.FILENAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}`, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    if (response.status === 401) throw new Error("401");
    const data = await response.json();
    const fileId = data.files?.[0]?.id;
    if (!fileId) throw new Error("NOT_FOUND");
    this.spreadsheetId = String(fileId || '');
    return this.spreadsheetId;
  }

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
      const response = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(spreadsheet)
      });
      const data = await response.json();
      id = String(data.spreadsheetId || '');
      this.spreadsheetId = id;

      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchUpdate`, {
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
            { range: 'Gastos!A1:I1', values: [['ID Ticket', 'Tienda', 'Fecha', 'Producto', 'Categoría', 'Cantidad', 'P. Unitario', 'Descuento', 'Total Línea']] },
            { range: 'Rules!A1:C1', values: [['Original_Pattern', 'Normalized_Name', 'Category']] }
          ]
        })
      });
    }

    const settings = await this.getSettings(id);
    return { settings, dbId: id };
  }

  async getSettings(forcedId?: string): Promise<OmniSettings> {
    const id = forcedId || await this.getOrFindId();
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/Settings!A1:B5`, {
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

  async updateGeminiKey(key: string): Promise<void> {
    const id = await this.getOrFindId();
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/Settings!B3?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[String(key || '').trim()]] })
    });
  }

  async updateLastSync(): Promise<void> {
    const id = await this.getOrFindId();
    const now = new Date().toLocaleString();
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/Settings!B4?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[String(now)]] })
    });
  }
}
