import { useState, useEffect, useCallback, useMemo } from 'react';
import { SheetsService } from '@/services/SheetsService';
import type { HistoryTicket, Rule, Category } from '@/shared/types/domain';
import { safeText, getErrorMessage, aggregateByKey, parseGastosRow } from '@/lib/utils';
import { TOTAL_TICKET_MARKER, GastosCol } from '@/lib/constants';

interface UseAppDataResult {
  rawLines: string[][];
  history: HistoryTicket[];
  rules: Rule[];
  categories: Category[];
  categoryCounts: Map<string, number>;
  loadData: () => Promise<void>;
}

/**
 * Manages all application data: line items, history, rules, categories.
 * Extracted from App.tsx to reduce its responsibilities.
 */
export function useAppData(
  token: string | null,
  dbId: string | null,
  toast: { error: (msg: string) => void },
): UseAppDataResult {
  const [rawLines, setRawLines] = useState<string[][]>([]);
  const [history, setHistory] = useState<HistoryTicket[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const loadData = useCallback(async () => {
    if (!token || !dbId) return;
    const sheets = new SheetsService(token);
    try {
      const [lines, r, cats] = await Promise.all([
        sheets.fetchAllLineItems(dbId),
        sheets.getRules(dbId),
        sheets.getCategories(dbId),
      ]);
      setRawLines(lines);
      setRules(r);
      setCategories(cats);

      // Derive history from raw lines
      const historyMap = new Map<string, HistoryTicket>();
      lines.forEach((row) => {
        const parsed = parseGastosRow(row);
        if (!parsed.id) return;
        if (parsed.producto === TOTAL_TICKET_MARKER) {
          historyMap.set(parsed.id, { id: parsed.id, tienda: parsed.tienda, fecha: parsed.fecha, total: parsed.totalLinea });
        } else if (!historyMap.has(parsed.id)) {
          historyMap.set(parsed.id, { id: parsed.id, tienda: parsed.tienda, fecha: parsed.fecha, total: 0 });
        }
      });
      setHistory(Array.from(historyMap.values()).sort((a, b) => b.fecha.localeCompare(a.fecha)));
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      if (msg === '401') {
        toast.error('Sesión expirada. Haz clic en "Reconectar" para continuar.');
      } else {
        console.error('Error al cargar datos', err);
      }
    }
  }, [token, dbId, toast]);

  const categoryCounts = useMemo(() =>
    aggregateByKey(
      rawLines.filter(row => {
        const name = safeText(row[GastosCol.PRODUCTO] || '');
        return name && name !== TOTAL_TICKET_MARKER;
      }),
      row => safeText(row[GastosCol.CATEGORIA] || ''),
      () => 1,
    ),
  [rawLines]);

  return { rawLines, history, rules, categories, categoryCounts, loadData };
}
