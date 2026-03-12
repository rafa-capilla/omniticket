import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SheetsService } from '../SheetsService';

// ─── mock apiFetch ───────────────────────────────────────────────────────────

vi.mock('../apiFetch', () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from '../apiFetch';
const mockApiFetch = vi.mocked(apiFetch);

const SPREADSHEET_ID = 'test-spreadsheet-id';
const TOKEN = 'test-token';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(() => {
  mockApiFetch.mockReset();
});

// ─── getCategories ───────────────────────────────────────────────────────────

describe('SheetsService.getCategories', () => {
  it('parses rows into Category objects with correct types', async () => {
    mockApiFetch.mockResolvedValue(
      jsonResponse({
        values: [
          ['Lácteos', 'Leche y yogures', 'active'],
          ['Limpieza', 'Detergentes', 'inactive'],
          ['Otros', 'Miscelánea', 'ACTIVE'],
        ],
      })
    );

    const sheets = new SheetsService(TOKEN);
    const result = await sheets.getCategories(SPREADSHEET_ID);

    expect(result).toEqual([
      { name: 'Lácteos', description: 'Leche y yogures', status: 'active' },
      { name: 'Limpieza', description: 'Detergentes', status: 'inactive' },
      { name: 'Otros', description: 'Miscelánea', status: 'active' },
    ]);
  });

  it('filters out rows with empty name', async () => {
    mockApiFetch.mockResolvedValue(
      jsonResponse({
        values: [
          ['Bebidas', 'Agua y refrescos', 'active'],
          ['', 'Sin nombre', 'active'],
        ],
      })
    );

    const sheets = new SheetsService(TOKEN);
    const result = await sheets.getCategories(SPREADSHEET_ID);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bebidas');
  });

  it('returns empty array when no values are present', async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({}));

    const sheets = new SheetsService(TOKEN);
    const result = await sheets.getCategories(SPREADSHEET_ID);

    expect(result).toEqual([]);
  });

  it('returns empty array on API error instead of throwing', async () => {
    mockApiFetch.mockRejectedValue(new Error('Network error'));

    const sheets = new SheetsService(TOKEN);
    const result = await sheets.getCategories(SPREADSHEET_ID);

    expect(result).toEqual([]);
  });

  it('defaults to active when status is unrecognized', async () => {
    mockApiFetch.mockResolvedValue(
      jsonResponse({ values: [['Test', 'Desc', 'something']] })
    );

    const sheets = new SheetsService(TOKEN);
    const result = await sheets.getCategories(SPREADSHEET_ID);

    expect(result[0].status).toBe('active');
  });
});

// ─── getRules ────────────────────────────────────────────────────────────────

describe('SheetsService.getRules', () => {
  it('parses rows into Rule objects', async () => {
    mockApiFetch.mockResolvedValue(
      jsonResponse({
        values: [
          ['agua con gas', 'Agua con Gas', 'Bebidas'],
          ['leche', 'Leche Entera', 'Lácteos'],
        ],
      })
    );

    const sheets = new SheetsService(TOKEN);
    const result = await sheets.getRules(SPREADSHEET_ID);

    expect(result).toEqual([
      { pattern: 'agua con gas', normalized: 'Agua con Gas', category: 'Bebidas' },
      { pattern: 'leche', normalized: 'Leche Entera', category: 'Lácteos' },
    ]);
  });

  it('defaults category to Otros when missing', async () => {
    mockApiFetch.mockResolvedValue(
      jsonResponse({ values: [['patrón', 'Nombre']] })
    );

    const sheets = new SheetsService(TOKEN);
    const result = await sheets.getRules(SPREADSHEET_ID);

    expect(result[0].category).toBe('Otros');
  });

  it('returns empty array on API error', async () => {
    mockApiFetch.mockRejectedValue(new Error('403'));

    const sheets = new SheetsService(TOKEN);
    const result = await sheets.getRules(SPREADSHEET_ID);

    expect(result).toEqual([]);
  });
});

// ─── appendExpense ───────────────────────────────────────────────────────────

describe('SheetsService.appendExpense', () => {
  it('constructs correct row layout: [id, tienda, fecha, nombre, categoria, cantidad, precio_unitario, descuento, total, normalizado]', async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({}));

    const sheets = new SheetsService(TOKEN);
    await sheets.appendExpense(SPREADSHEET_ID, {
      id: 'uuid-1',
      tienda: 'Mercadona',
      fecha: '2025-01-15',
      items: [
        {
          nombre: 'COCA COLA ZERO 2L',
          nombre_normalizado: 'Coca Cola Zero',
          categoria: 'Bebidas',
          precio_unitario: 1.5,
          cantidad: 2,
          descuento: 0,
          precio_total_linea: 3.0,
        },
      ],
      total_ticket: 3.0,
    });

    expect(mockApiFetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(mockApiFetch.mock.calls[0][1]?.body as string);

    // Item row
    expect(body.values[0]).toEqual([
      'uuid-1', 'Mercadona', '2025-01-15',
      'COCA COLA ZERO 2L', 'Bebidas',
      2, 1.5, 0, 3.0,
      'Coca Cola Zero',
    ]);

    // Total row
    expect(body.values[1][3]).toBe('--- TOTAL TICKET ---');
    expect(body.values[1][4]).toBe('TOTAL');
    expect(body.values[1][8]).toBe(3.0);
  });

  it('uses empty string when nombre_normalizado is undefined', async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({}));

    const sheets = new SheetsService(TOKEN);
    await sheets.appendExpense(SPREADSHEET_ID, {
      id: 'uuid-2',
      tienda: 'Lidl',
      fecha: '2025-02-01',
      items: [
        {
          nombre: 'PAN MOLDE',
          categoria: 'Otros',
          precio_unitario: 1.0,
          cantidad: 1,
          descuento: 0,
          precio_total_linea: 1.0,
        },
      ],
      total_ticket: 1.0,
    });

    const body = JSON.parse(mockApiFetch.mock.calls[0][1]?.body as string);
    expect(body.values[0][9]).toBe('');
  });

  it('appends multiple items plus a total row', async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({}));

    const sheets = new SheetsService(TOKEN);
    await sheets.appendExpense(SPREADSHEET_ID, {
      id: 'uuid-3',
      tienda: 'Carrefour',
      fecha: '2025-03-01',
      items: [
        { nombre: 'A', nombre_normalizado: 'a', categoria: 'X', precio_unitario: 1, cantidad: 1, descuento: 0, precio_total_linea: 1 },
        { nombre: 'B', nombre_normalizado: 'b', categoria: 'Y', precio_unitario: 2, cantidad: 3, descuento: 0.5, precio_total_linea: 5.5 },
      ],
      total_ticket: 6.5,
    });

    const body = JSON.parse(mockApiFetch.mock.calls[0][1]?.body as string);
    expect(body.values).toHaveLength(3); // 2 items + 1 total
    expect(body.values[2][8]).toBe(6.5); // total row
  });
});

// ─── updateCategoryInGastos ──────────────────────────────────────────────────

describe('SheetsService.updateCategoryInGastos', () => {
  it('sends batch update for rows matching the old category', async () => {
    // First call: fetchAllLineItems
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({
        values: [
          ['id1', 'Store', '2025-01-01', 'Prod1', 'Limpieza', '1', '2.00', '0', '2.00', 'Prod1'],
          ['id1', 'Store', '2025-01-01', 'Prod2', 'Bebidas', '1', '1.50', '0', '1.50', 'Prod2'],
          ['id1', 'Store', '2025-01-01', 'Prod3', 'Limpieza', '2', '3.00', '0', '6.00', 'Prod3'],
        ],
      })
    );
    // Second call: batchUpdate
    mockApiFetch.mockResolvedValueOnce(jsonResponse({}));

    const sheets = new SheetsService(TOKEN);
    await sheets.updateCategoryInGastos(SPREADSHEET_ID, 'Limpieza', 'Higiene');

    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    const batchBody = JSON.parse(mockApiFetch.mock.calls[1][1]?.body as string);

    expect(batchBody.data).toEqual([
      { range: 'Gastos!E2', values: [['Higiene']] },
      { range: 'Gastos!E4', values: [['Higiene']] },
    ]);
  });

  it('does not call batchUpdate when no rows match', async () => {
    mockApiFetch.mockResolvedValueOnce(
      jsonResponse({
        values: [
          ['id1', 'Store', '2025-01-01', 'Prod1', 'Bebidas', '1', '1.50', '0', '1.50', 'Prod1'],
        ],
      })
    );

    const sheets = new SheetsService(TOKEN);
    await sheets.updateCategoryInGastos(SPREADSHEET_ID, 'Limpieza', 'Higiene');

    expect(mockApiFetch).toHaveBeenCalledTimes(1); // only fetchAllLineItems
  });
});

// ─── fetchAllLineItems ───────────────────────────────────────────────────────

describe('SheetsService.fetchAllLineItems', () => {
  it('returns raw string[][] from Gastos sheet', async () => {
    const rows = [
      ['id1', 'Mercadona', '2025-01-15', 'Leche', 'Lácteos', '1', '1.20', '0', '1.20', 'Leche'],
    ];
    mockApiFetch.mockResolvedValue(jsonResponse({ values: rows }));

    const sheets = new SheetsService(TOKEN);
    const result = await sheets.fetchAllLineItems(SPREADSHEET_ID);

    expect(result).toEqual(rows);
  });

  it('returns empty array when no data exists', async () => {
    mockApiFetch.mockResolvedValue(jsonResponse({}));

    const sheets = new SheetsService(TOKEN);
    const result = await sheets.fetchAllLineItems(SPREADSHEET_ID);

    expect(result).toEqual([]);
  });
});
