import { TicketData, SheetsValuesResponse } from '../../types';
import { TOTAL_TICKET_MARKER, SHEETS_API, SheetName } from '../../lib/constants';
import { authHeaders, jsonAuthHeaders } from '../../lib/utils';
import { apiFetch } from '../../services/apiFetch';
import type { ExpenseRepository } from '../../application/ports/ExpenseRepository';

/**
 * Implements ExpenseRepository using Google Sheets API.
 */
export class SheetsExpenseRepo implements ExpenseRepository {
  constructor(private accessToken: string) {}

  private get auth()     { return authHeaders(this.accessToken); }
  private get jsonAuth() { return jsonAuthHeaders(this.accessToken); }

  async appendExpense(spreadsheetId: string, data: TicketData): Promise<void> {
    const itemRows = data.items.map(item => [
      data.id, data.tienda, data.fecha,
      item.nombre, item.categoria,
      item.cantidad, item.precio_unitario, item.descuento, item.precio_total_linea,
      item.nombre_normalizado ?? ''
    ]);
    const totalRow = [
      data.id, data.tienda, data.fecha, TOTAL_TICKET_MARKER, 'TOTAL', '', '', '', data.total_ticket, ''
    ];
    const values = [...itemRows, totalRow];
    await apiFetch(
      `${SHEETS_API}/${spreadsheetId}/values/${SheetName.GASTOS}!A:J:append?valueInputOption=USER_ENTERED`,
      { method: 'POST', headers: this.jsonAuth, body: JSON.stringify({ values }) }
    );
  }

  async fetchAllLineItems(spreadsheetId: string): Promise<string[][]> {
    const response = await apiFetch(
      `${SHEETS_API}/${spreadsheetId}/values/${SheetName.GASTOS}!A2:J`,
      { headers: this.auth }
    );
    const data: SheetsValuesResponse = await response.json();
    return data.values ?? [];
  }
}
