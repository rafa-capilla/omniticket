import type { DashboardStats, AggregatedData, Category } from '@/shared/types/domain';
import { safeText, safeNum, aggregateByKey } from '@/lib/utils';
import { TOTAL_TICKET_MARKER, GastosCol } from '@/lib/constants';

/**
 * Pure domain service for aggregating expense data.
 * No I/O dependencies - operates entirely on in-memory data.
 */

/**
 * Calculates dashboard KPI statistics from processed expense rows.
 */
export function calculateKPIs(processedData: string[][]): DashboardStats {
  let total = 0;
  let count = 0;
  const catMap = new Map<string, number>();

  processedData.forEach((row: string[]) => {
    if (row[GastosCol.PRODUCTO] === TOTAL_TICKET_MARKER) {
      total += safeNum(row[GastosCol.TOTAL_LINEA]);
      count++;
    } else {
      const cat = safeText(row[GastosCol.CATEGORIA]);
      catMap.set(cat, (catMap.get(cat) ?? 0) + safeNum(row[GastosCol.TOTAL_LINEA]));
    }
  });

  let topCat = 'Ninguna';
  let maxVal = -1;
  catMap.forEach((v, k) => { if (v > maxVal) { maxVal = v; topCat = k; } });

  return {
    totalSpent: total,
    avgTicket: count > 0 ? total / count : 0,
    topCategory: topCat,
    ticketCount: count,
  };
}

/**
 * Aggregates data rows by a specific lens (products, categories, or stores).
 * Returns sorted array of { name, value } entries.
 */
export function aggregateByLens(
  processedData: string[][],
  lens: 'products' | 'categories' | 'stores',
  activeCategories: Category[],
): { name: string; value: number }[] {
  const dataRows = processedData.filter((row: string[]) =>
    row[GastosCol.PRODUCTO] && row[GastosCol.PRODUCTO] !== TOTAL_TICKET_MARKER,
  );

  const colIndex =
    lens === 'stores' ? GastosCol.TIENDA
    : lens === 'categories' ? GastosCol.CATEGORIA
    : GastosCol.PRODUCTO;

  const agg = aggregateByKey(
    dataRows,
    row => safeText(row[colIndex]),
    row => safeNum(row[GastosCol.TOTAL_LINEA]),
  );

  // Ensure all active categories appear even with 0 spend
  if (lens === 'categories') {
    for (const c of activeCategories) {
      if (!agg.has(c.name)) agg.set(c.name, 0);
    }
  }

  return Array.from(agg.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Builds the full AggregatedData object used by AIAnalysisView.
 * Consolidates the aggregation logic that was duplicated between LensesView and AIAnalysisView.
 */
export function buildAggregatedData(
  rawLines: string[][],
  dateRange: { start: string; end: string },
  categories: Category[],
): AggregatedData {
  const inRange = rawLines.filter((row: string[]) => {
    const date = row[GastosCol.FECHA] ?? '';
    return date >= dateRange.start && date <= dateRange.end;
  });

  const totalRows = inRange.filter(row => row[GastosCol.PRODUCTO] === TOTAL_TICKET_MARKER);
  const dataRows = inRange.filter(row => row[GastosCol.PRODUCTO] !== TOTAL_TICKET_MARKER);

  const totalSpent = totalRows.reduce((sum, row) => sum + safeNum(row[GastosCol.TOTAL_LINEA]), 0);
  const ticketCount = totalRows.length;

  const catMap = aggregateByKey(
    dataRows,
    row => safeText(row[GastosCol.CATEGORIA] ?? 'Otros'),
    row => safeNum(row[GastosCol.TOTAL_LINEA]),
  );
  const prodMap = aggregateByKey(
    dataRows,
    row => safeText(row[GastosCol.NOMBRE_NORM] ?? '') || safeText(row[GastosCol.PRODUCTO] ?? ''),
    row => safeNum(row[GastosCol.TOTAL_LINEA]),
  );
  const storeMap = aggregateByKey(
    dataRows,
    row => safeText(row[GastosCol.TIENDA] ?? ''),
    row => safeNum(row[GastosCol.TOTAL_LINEA]),
  );

  categories.forEach(c => { if (!catMap.has(c.name)) catMap.set(c.name, 0); });

  const lineItems = dataRows.map((row: string[]) => {
    const date = row[GastosCol.FECHA] ?? '';
    const store = safeText(row[GastosCol.TIENDA] ?? '');
    const prod = safeText(row[GastosCol.NOMBRE_NORM] ?? '') || safeText(row[GastosCol.PRODUCTO] ?? '');
    const cat = safeText(row[GastosCol.CATEGORIA] ?? 'Otros');
    const cant = row[GastosCol.CANTIDAD] ?? '';
    const pUnit = safeNum(row[GastosCol.PRECIO_UNIT]);
    const amount = safeNum(row[GastosCol.TOTAL_LINEA]);
    return `${date}|${store}|${prod}|${cat}|${cant}|${pUnit.toFixed(2)}€|${amount.toFixed(2)}€`;
  });

  const mapToSorted = (m: Map<string, number>) =>
    Array.from(m.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);

  return {
    period: dateRange,
    totalSpent,
    ticketCount,
    byCategory: Array.from(catMap.entries())
      .map(([name, total]) => ({ name, total, percentage: totalSpent > 0 ? (total / totalSpent) * 100 : 0 }))
      .sort((a, b) => b.total - a.total),
    byProduct: mapToSorted(prodMap),
    byStore: mapToSorted(storeMap),
    lineItems,
  };
}

/**
 * Filters raw rows by date range.
 */
export function filterByDateRange(
  rawLines: string[][],
  dateRange: { start: string; end: string },
): string[][] {
  return rawLines.filter((row: string[]) => {
    const date = row[GastosCol.FECHA] ?? '';
    return date >= dateRange.start && date <= dateRange.end;
  });
}
