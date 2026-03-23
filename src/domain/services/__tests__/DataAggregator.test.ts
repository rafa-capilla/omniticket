import { describe, it, expect } from 'vitest';
import { calculateKPIs, aggregateByLens, buildAggregatedData, filterByDateRange, deriveHistoryFromLines } from '../DataAggregator';
import type { Category } from '@/shared/types/domain';
import { GastosCol, TOTAL_TICKET_MARKER, NO_CATEGORY_LABEL } from '@/lib/constants';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeRow(
  product: string,
  category: string,
  totalLinea: string,
  opts?: { tienda?: string; fecha?: string; normalized?: string; cantidad?: string; precioUnit?: string },
): string[] {
  const row: string[] = [];
  row[GastosCol.ID] = 'uuid-1';
  row[GastosCol.TIENDA] = opts?.tienda ?? 'Mercadona';
  row[GastosCol.FECHA] = opts?.fecha ?? '2025-01-15';
  row[GastosCol.PRODUCTO] = product;
  row[GastosCol.CATEGORIA] = category;
  row[GastosCol.CANTIDAD] = opts?.cantidad ?? '1';
  row[GastosCol.PRECIO_UNIT] = opts?.precioUnit ?? totalLinea;
  row[GastosCol.DESCUENTO] = '0';
  row[GastosCol.TOTAL_LINEA] = totalLinea;
  row[GastosCol.NOMBRE_NORM] = opts?.normalized ?? '';
  return row;
}

function makeTotalRow(total: string, opts?: { fecha?: string; tienda?: string }): string[] {
  return makeRow(TOTAL_TICKET_MARKER, '', total, opts);
}

const defaultCategories: Category[] = [
  { name: 'Bebidas', description: '', status: 'active' },
  { name: 'Lácteos', description: '', status: 'active' },
  { name: 'Otros', description: '', status: 'active' },
];

// ─── calculateKPIs ──────────────────────────────────────────────────────────

describe('calculateKPIs', () => {
  it('calculates total spent from TOTAL_TICKET_MARKER rows', () => {
    const data = [
      makeRow('Leche', 'Lácteos', '1.20'),
      makeTotalRow('5.00'),
      makeRow('Coca Cola', 'Bebidas', '2.50'),
      makeTotalRow('3.00'),
    ];

    const stats = calculateKPIs(data);

    expect(stats.totalSpent).toBe(8.00);
    expect(stats.ticketCount).toBe(2);
  });

  it('calculates average ticket correctly', () => {
    const data = [
      makeTotalRow('10.00'),
      makeTotalRow('20.00'),
    ];

    const stats = calculateKPIs(data);

    expect(stats.avgTicket).toBe(15.00);
  });

  it('returns avgTicket 0 when no tickets', () => {
    const stats = calculateKPIs([]);

    expect(stats.avgTicket).toBe(0);
    expect(stats.ticketCount).toBe(0);
  });

  it('identifies top category by total spend', () => {
    const data = [
      makeRow('Leche', 'Lácteos', '3.00'),
      makeRow('Yogur', 'Lácteos', '2.00'),
      makeRow('Coca Cola', 'Bebidas', '1.50'),
    ];

    const stats = calculateKPIs(data);

    expect(stats.topCategory).toBe('Lácteos');
  });

  it('returns "Ninguna" when no data rows', () => {
    const data = [makeTotalRow('5.00')];

    const stats = calculateKPIs(data);

    expect(stats.topCategory).toBe(NO_CATEGORY_LABEL);
  });

  it('handles empty input', () => {
    const stats = calculateKPIs([]);

    expect(stats.totalSpent).toBe(0);
    expect(stats.ticketCount).toBe(0);
    expect(stats.topCategory).toBe(NO_CATEGORY_LABEL);
    expect(stats.avgTicket).toBe(0);
  });
});

// ─── aggregateByLens ────────────────────────────────────────────────────────

describe('aggregateByLens', () => {
  it('aggregates by products (uses PRODUCTO column)', () => {
    const data = [
      makeRow('Leche', 'Lácteos', '1.20'),
      makeRow('Leche', 'Lácteos', '1.20'),
      makeRow('Pan', 'Otros', '0.80'),
    ];

    const result = aggregateByLens(data, 'products', defaultCategories);

    expect(result[0]).toEqual({ name: 'Leche', value: 2.40 });
    expect(result[1]).toEqual({ name: 'Pan', value: 0.80 });
  });

  it('aggregates by categories', () => {
    const data = [
      makeRow('Leche', 'Lácteos', '3.00'),
      makeRow('Coca Cola', 'Bebidas', '1.50'),
    ];

    const result = aggregateByLens(data, 'categories', defaultCategories);
    const lacteos = result.find(r => r.name === 'Lácteos');
    const bebidas = result.find(r => r.name === 'Bebidas');

    expect(lacteos!.value).toBe(3.00);
    expect(bebidas!.value).toBe(1.50);
  });

  it('aggregates by stores', () => {
    const data = [
      makeRow('Leche', 'Lácteos', '3.00', { tienda: 'Mercadona' }),
      makeRow('Pan', 'Otros', '1.00', { tienda: 'Lidl' }),
      makeRow('Yogur', 'Lácteos', '2.00', { tienda: 'Mercadona' }),
    ];

    const result = aggregateByLens(data, 'stores', defaultCategories);

    expect(result[0]).toEqual({ name: 'Mercadona', value: 5.00 });
    expect(result[1]).toEqual({ name: 'Lidl', value: 1.00 });
  });

  it('excludes TOTAL_TICKET_MARKER rows', () => {
    const data = [
      makeRow('Leche', 'Lácteos', '1.20'),
      makeTotalRow('1.20'),
    ];

    const result = aggregateByLens(data, 'products', defaultCategories);

    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Leche');
  });

  it('includes all active categories with 0 spend for categories lens', () => {
    const data = [
      makeRow('Leche', 'Lácteos', '1.20'),
    ];

    const result = aggregateByLens(data, 'categories', defaultCategories);

    expect(result.find(r => r.name === 'Bebidas')!.value).toBe(0);
    expect(result.find(r => r.name === 'Otros')!.value).toBe(0);
  });

  it('does NOT add zero-spend categories for products or stores lenses', () => {
    const data = [
      makeRow('Leche', 'Lácteos', '1.20'),
    ];

    const products = aggregateByLens(data, 'products', defaultCategories);
    const stores = aggregateByLens(data, 'stores', defaultCategories);

    expect(products).toHaveLength(1);
    expect(stores).toHaveLength(1);
  });

  it('sorts results descending by value', () => {
    const data = [
      makeRow('Pan', 'Otros', '0.80'),
      makeRow('Leche', 'Lácteos', '3.00'),
      makeRow('Coca Cola', 'Bebidas', '1.50'),
    ];

    const result = aggregateByLens(data, 'products', defaultCategories);

    expect(result[0]!.name).toBe('Leche');
    expect(result[1]!.name).toBe('Coca Cola');
    expect(result[2]!.name).toBe('Pan');
  });

  it('handles empty data', () => {
    const result = aggregateByLens([], 'products', defaultCategories);
    expect(result).toEqual([]);
  });
});

// ─── filterByDateRange ──────────────────────────────────────────────────────

describe('filterByDateRange', () => {
  it('filters rows within the date range (inclusive)', () => {
    const data = [
      makeRow('A', 'Otros', '1.00', { fecha: '2025-01-10' }),
      makeRow('B', 'Otros', '2.00', { fecha: '2025-01-15' }),
      makeRow('C', 'Otros', '3.00', { fecha: '2025-01-20' }),
      makeRow('D', 'Otros', '4.00', { fecha: '2025-01-25' }),
    ];

    const result = filterByDateRange(data, { start: '2025-01-15', end: '2025-01-20' });

    expect(result).toHaveLength(2);
  });

  it('includes boundary dates', () => {
    const data = [
      makeRow('A', 'Otros', '1.00', { fecha: '2025-01-15' }),
      makeRow('B', 'Otros', '2.00', { fecha: '2025-01-20' }),
    ];

    const result = filterByDateRange(data, { start: '2025-01-15', end: '2025-01-20' });

    expect(result).toHaveLength(2);
  });

  it('returns empty for out-of-range data', () => {
    const data = [
      makeRow('A', 'Otros', '1.00', { fecha: '2025-02-01' }),
    ];

    const result = filterByDateRange(data, { start: '2025-01-01', end: '2025-01-31' });

    expect(result).toHaveLength(0);
  });

  it('handles rows with missing date (empty string)', () => {
    const data = [
      makeRow('A', 'Otros', '1.00', { fecha: '' }),
    ];

    const result = filterByDateRange(data, { start: '2025-01-01', end: '2025-12-31' });

    // Empty string '' is less than '2025-01-01', so excluded
    expect(result).toHaveLength(0);
  });
});

// ─── buildAggregatedData ────────────────────────────────────────────────────

describe('buildAggregatedData', () => {
  const dateRange = { start: '2025-01-01', end: '2025-01-31' };

  it('returns correct totalSpent and ticketCount', () => {
    const data = [
      makeRow('Leche', 'Lácteos', '1.20', { fecha: '2025-01-15' }),
      makeTotalRow('5.00', { fecha: '2025-01-15' }),
      makeTotalRow('3.00', { fecha: '2025-01-20' }),
    ];

    const result = buildAggregatedData(data, dateRange, defaultCategories);

    expect(result.totalSpent).toBe(8.00);
    expect(result.ticketCount).toBe(2);
  });

  it('filters by date range', () => {
    const data = [
      makeTotalRow('5.00', { fecha: '2025-01-15' }),
      makeTotalRow('3.00', { fecha: '2025-02-15' }),
    ];

    const result = buildAggregatedData(data, dateRange, defaultCategories);

    expect(result.totalSpent).toBe(5.00);
    expect(result.ticketCount).toBe(1);
  });

  it('includes all active categories with 0 in byCategory', () => {
    const data = [
      makeRow('Leche', 'Lácteos', '1.20', { fecha: '2025-01-15' }),
    ];

    const result = buildAggregatedData(data, dateRange, defaultCategories);

    expect(result.byCategory.find(c => c.name === 'Bebidas')!.total).toBe(0);
    expect(result.byCategory.find(c => c.name === 'Otros')!.total).toBe(0);
  });

  it('calculates percentages in byCategory', () => {
    const data = [
      makeRow('Leche', 'Lácteos', '3.00', { fecha: '2025-01-15' }),
      makeRow('Coca Cola', 'Bebidas', '1.00', { fecha: '2025-01-15' }),
      makeTotalRow('4.00', { fecha: '2025-01-15' }),
    ];

    const result = buildAggregatedData(data, dateRange, defaultCategories);
    const lacteos = result.byCategory.find(c => c.name === 'Lácteos');

    expect(lacteos!.percentage).toBe(75);
  });

  it('sorts byCategory, byProduct, byStore descending by total', () => {
    const data = [
      makeRow('Pan', 'Otros', '0.50', { fecha: '2025-01-15', tienda: 'Lidl' }),
      makeRow('Leche', 'Lácteos', '3.00', { fecha: '2025-01-15', tienda: 'Mercadona' }),
    ];

    const result = buildAggregatedData(data, dateRange, defaultCategories);

    expect(result.byProduct[0]!.name).toBe('Leche');
    expect(result.byStore[0]!.name).toBe('Mercadona');
  });

  it('generates pipe-delimited lineItems from data rows', () => {
    const data = [
      makeRow('Leche', 'Lácteos', '1.20', {
        fecha: '2025-01-15',
        tienda: 'Mercadona',
        cantidad: '2',
        precioUnit: '0.60',
      }),
    ];

    const result = buildAggregatedData(data, dateRange, defaultCategories);

    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]).toContain('2025-01-15');
    expect(result.lineItems[0]).toContain('Mercadona');
    expect(result.lineItems[0]).toContain('1.20€');
  });

  it('returns period in the result', () => {
    const result = buildAggregatedData([], dateRange, defaultCategories);

    expect(result.period).toEqual(dateRange);
  });

  it('handles empty data', () => {
    const result = buildAggregatedData([], dateRange, defaultCategories);

    expect(result.totalSpent).toBe(0);
    expect(result.ticketCount).toBe(0);
    expect(result.byProduct).toEqual([]);
    expect(result.byStore).toEqual([]);
    expect(result.lineItems).toEqual([]);
    // All active categories should appear with 0
    expect(result.byCategory).toHaveLength(3);
  });
});

// ─── deriveHistoryFromLines ────────────────────────────────────────────────

describe('deriveHistoryFromLines', () => {
  it('derives one HistoryTicket per unique ticket ID', () => {
    const data = [
      makeRow('Leche', 'Lácteos', '1.20'),
      makeTotalRow('5.00'),
    ];

    const result = deriveHistoryFromLines(data);

    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('uuid-1');
    expect(result[0]!.total).toBe(5.00);
  });

  it('uses total from TOTAL_TICKET_MARKER row', () => {
    const data = [
      makeRow('Leche', 'Lácteos', '1.20'),
      makeRow('Pan', 'Otros', '0.80'),
      makeTotalRow('2.00'),
    ];

    const result = deriveHistoryFromLines(data);

    expect(result[0]!.total).toBe(2.00);
  });

  it('handles tickets with no TOTAL_TICKET_MARKER (total defaults to 0)', () => {
    const data = [
      makeRow('Leche', 'Lácteos', '1.20'),
    ];

    const result = deriveHistoryFromLines(data);

    expect(result).toHaveLength(1);
    expect(result[0]!.total).toBe(0);
  });

  it('sorts results newest-first by fecha', () => {
    const row1 = makeRow('A', 'Otros', '1.00', { fecha: '2025-01-10' });
    row1[GastosCol.ID] = 'id-old';
    const total1 = makeTotalRow('1.00', { fecha: '2025-01-10' });
    total1[GastosCol.ID] = 'id-old';

    const row2 = makeRow('B', 'Otros', '2.00', { fecha: '2025-02-15' });
    row2[GastosCol.ID] = 'id-new';
    const total2 = makeTotalRow('2.00', { fecha: '2025-02-15' });
    total2[GastosCol.ID] = 'id-new';

    const result = deriveHistoryFromLines([row1, total1, row2, total2]);

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('id-new');
    expect(result[1]!.id).toBe('id-old');
  });

  it('skips rows with empty ID', () => {
    const row = makeRow('A', 'Otros', '1.00');
    row[GastosCol.ID] = '';

    const result = deriveHistoryFromLines([row]);

    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty input', () => {
    expect(deriveHistoryFromLines([])).toEqual([]);
  });
});
