import { useMemo } from 'react';
import type { Rule, Category, LensType, DashboardStats, DateRange } from '@/shared/types/domain';
import { GastosCol, TOTAL_TICKET_MARKER } from '@/lib/constants';
import { applyRulesToRows } from '@/domain/services/RuleEngine';
import { calculateKPIs, aggregateByLens, filterByDateRange } from '@/domain/services/DataAggregator';

interface UseDataAggregationResult {
  /** Rows after date filtering + rule application */
  processedData: string[][];
  /** KPI statistics (total spent, avg ticket, top category, ticket count) */
  stats: DashboardStats;
  /** Aggregated data for the current lens */
  lensData: { name: string; value: number }[];
}

/**
 * Encapsulates the data processing pipeline for LensesView:
 * raw lines → date filter → rule application → KPIs + lens aggregation.
 *
 * Extracted from LensesView.tsx to separate business logic from presentation.
 */
export function useDataAggregation(
  rawLines: string[][],
  dateRange: DateRange,
  rules: Rule[],
  categories: Category[],
  currentLens: LensType,
): UseDataAggregationResult {
  const activeCategories = useMemo(
    () => categories.filter(c => c.status === 'active'),
    [categories],
  );

  const processedData = useMemo(() => {
    const filtered = filterByDateRange(rawLines, dateRange);
    return applyRulesToRows(
      filtered, rules,
      GastosCol.PRODUCTO, GastosCol.CATEGORIA, GastosCol.NOMBRE_NORM,
      TOTAL_TICKET_MARKER,
    );
  }, [rawLines, dateRange, rules]);

  const stats = useMemo(() => calculateKPIs(processedData), [processedData]);

  const lensData = useMemo(() => {
    if (currentLens === 'analysis') return [];
    return aggregateByLens(processedData, currentLens, activeCategories);
  }, [processedData, currentLens, activeCategories]);

  return { processedData, stats, lensData };
}
