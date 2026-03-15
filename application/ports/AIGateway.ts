import { TicketData, Category, Rule, AggregatedData, AIAnalysisResult } from '../../shared/types/domain';

/**
 * Port for AI service operations.
 * Abstracts the AI provider used for ticket extraction and free-form analysis.
 */
export interface AIGateway {
  extractTicketData(
    emailContent: string,
    uuid: string,
    apiKey: string,
    categories: Category[],
    rules: Rule[],
  ): Promise<TicketData>;

  analyzeExpenses(
    prompt: string,
    data: AggregatedData,
    apiKey: string,
  ): Promise<AIAnalysisResult>;
}
