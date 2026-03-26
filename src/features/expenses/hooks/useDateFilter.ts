import { useState } from 'react';
import type { DateRange } from '@/shared/types/domain';
import { toLocalDateString } from '@/lib/utils';

/**
 * Manages date range state with a sensible default (current month).
 * Extracted from App.tsx to be reusable across views.
 */
export function useDateFilter() {
  const [dateRange, setDateRange] = useState<DateRange>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return {
      start: toLocalDateString(start),
      end: toLocalDateString(end),
    };
  });

  return { dateRange, setDateRange };
}
