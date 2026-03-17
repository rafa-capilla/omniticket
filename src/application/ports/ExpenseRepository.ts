import type { TicketData } from '@/shared/types/domain';

/**
 * Port for expense persistence operations.
 * Abstracts how expense data is stored and retrieved.
 */
export interface ExpenseRepository {
  appendExpense(spreadsheetId: string, data: TicketData): Promise<void>;
  fetchAllLineItems(spreadsheetId: string): Promise<string[][]>;
}
