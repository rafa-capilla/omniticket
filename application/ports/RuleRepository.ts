import { Rule } from '../../shared/types/domain';

/**
 * Port for rule persistence operations.
 * Abstracts how categorization rules are stored and retrieved.
 */
export interface RuleRepository {
  getRules(spreadsheetId: string): Promise<Rule[]>;
  addRule(spreadsheetId: string, rule: Rule): Promise<void>;
  updateRule(spreadsheetId: string, rowIndex: number, rule: Rule): Promise<void>;
  deleteRule(spreadsheetId: string, rowIndex: number): Promise<void>;
}
