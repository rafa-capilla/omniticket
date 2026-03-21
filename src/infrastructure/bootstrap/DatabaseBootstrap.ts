import type { DriveFilesResponse } from '@/shared/types/google-api';
import { SHEETS_API, DRIVE_API, SheetName } from '@/lib/constants';
import { authHeaders, jsonAuthHeaders } from '@/lib/utils';
import { apiFetch } from '@/infrastructure/google-api/apiFetch';
import { NotFoundError } from '@/domain/errors';

const FILENAME = 'OmniTicket_DB';

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
 * Responsible for finding or creating the OmniTicket spreadsheet.
 * Handles initial sheet creation and header setup.
 */
export class DatabaseBootstrap {
  constructor(private accessToken: string) {}

  private get auth()     { return authHeaders(this.accessToken); }
  private get jsonAuth() { return jsonAuthHeaders(this.accessToken); }

  /**
   * Searches Google Drive for the OmniTicket_DB spreadsheet.
   * @returns The spreadsheet ID.
   * @throws NotFoundError if not found, AuthExpiredError on auth failure.
   */
  async findSpreadsheet(): Promise<string> {
    const q = encodeURIComponent(`name = '${FILENAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`);
    const response = await apiFetch(`${DRIVE_API}?q=${q}`, { headers: this.auth });
    const data: DriveFilesResponse = await response.json();
    const fileId = data.files?.[0]?.id;
    if (!fileId) throw new NotFoundError('OmniTicket_DB spreadsheet');
    return String(fileId);
  }

  /**
   * Creates a new OmniTicket_DB spreadsheet with all required sheets and headers.
   * @returns The new spreadsheet ID.
   */
  async createSpreadsheet(): Promise<string> {
    const spreadsheet = {
      properties: { title: FILENAME },
      sheets: [
        { properties: { title: SheetName.SETTINGS } },
        { properties: { title: SheetName.GASTOS, gridProperties: { frozenRowCount: 1 } } },
        { properties: { title: SheetName.RULES, gridProperties: { frozenRowCount: 1 } } },
      ]
    };
    const response = await apiFetch(SHEETS_API, {
      method: 'POST',
      headers: this.jsonAuth,
      body: JSON.stringify(spreadsheet)
    });
    const data: { spreadsheetId?: string } = await response.json();
    const id = data.spreadsheetId;
    if (!id) {
      throw new Error('Google Sheets API returned no spreadsheetId when creating the database');
    }

    await this.initializeSheets(id);
    return id;
  }

  /** Writes default settings, headers, and initial data to a newly created spreadsheet. */
  private async initializeSheets(spreadsheetId: string): Promise<void> {
    await apiFetch(`${SHEETS_API}/${spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      headers: this.jsonAuth,
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: [
          { range: `${SheetName.SETTINGS}!A1:B4`, values: [
              ['GMAIL_SEARCH_LABEL', 'OmniTicket'],
              ['GMAIL_PROCESSED_LABEL', 'OmniTicket/Procesado'],
              ['GEMINI_API_KEY', ''],
              ['LAST_SYNC', 'Nunca']
          ]},
          { range: `${SheetName.GASTOS}!A1:J1`, values: [['ID Ticket', 'Tienda', 'Fecha', 'Producto', 'Categoría', 'Cantidad', 'P. Unitario', 'Descuento', 'Total Línea', 'Producto Normalizado']] },
          { range: `${SheetName.RULES}!A1:C1`, values: [['Original_Pattern', 'Normalized_Name', 'Category']] }
        ]
      })
    });
  }

  /** The default categories used when creating the Categories sheet for the first time. */
  static get defaultCategories(): string[][] {
    return DEFAULT_CATEGORIES;
  }
}
