
import { TicketData, HistoryTicket, ProductMapping, Rule } from '../types';

export class SheetsService {
  constructor(private accessToken: string) {}

  async appendExpense(spreadsheetId: string, data: TicketData) {
    const itemRows = data.items.map(item => [
      data.id, data.tienda, data.fecha, item.nombre, item.categoria, item.cantidad, item.precio_unitario, item.descuento, item.precio_total_linea
    ]);
    const totalRow = [
      data.id, data.tienda, data.fecha, '--- TOTAL TICKET ---', 'TOTAL', '', '', '', data.total_ticket
    ];
    const values = [...itemRows, totalRow];
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Gastos!A:I:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    });
  }

  async fetchAllLineItems(spreadsheetId: string): Promise<any[]> {
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Gastos!A2:I10000`, {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    const data = await response.json();
    return data.values || [];
  }

  async getMappings(spreadsheetId: string): Promise<ProductMapping[]> {
    try {
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Mapping_Cache!A:B`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      const data = await response.json();
      return (data.values || [])
        .filter((row: any[]) => row.length >= 2)
        .map((row: string[]) => ({ original: row[0], simplificado: row[1] }));
    } catch (err) {
      return [];
    }
  }

  async saveMappings(spreadsheetId: string, mappings: ProductMapping[]) {
    const values = mappings.map(m => [m.original, m.simplificado]);
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Mapping_Cache!A:B?valueInputOption=RAW`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    });
  }

  async getRules(spreadsheetId: string): Promise<Rule[]> {
    try {
      const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Rules!A2:C1000`, {
        headers: { Authorization: `Bearer ${this.accessToken}` }
      });
      const data = await response.json();
      return (data.values || []).map((row: string[]) => ({
        pattern: row[0],
        normalized: row[1],
        category: row[2]
      }));
    } catch (err) {
      return [];
    }
  }

  async addRule(spreadsheetId: string, rule: Rule) {
    const values = [[rule.pattern, rule.normalized, rule.category]];
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Rules!A:C:append?valueInputOption=RAW`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values })
    });
  }

  async fetchHistory(spreadsheetId: string): Promise<HistoryTicket[]> {
    const rows = await this.fetchAllLineItems(spreadsheetId);
    const historyMap = new Map<string, HistoryTicket>();
    
    rows.forEach((row: any[]) => {
      const id = row[0];
      const tienda = row[1];
      const fecha = row[2];
      const producto = row[3];
      const totalStr = String(row[8] || '0').replace(/[^\d.,-]/g, '').replace(',', '.');
      const total = parseFloat(totalStr) || 0;

      if (!id) return;

      if (producto === '--- TOTAL TICKET ---') {
        historyMap.set(id, { id, tienda, fecha, total });
      } else if (!historyMap.has(id)) {
        historyMap.set(id, { id, tienda, fecha, total: 0 });
      }
    });

    return Array.from(historyMap.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));
  }
}
