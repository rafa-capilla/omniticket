import type { AIGateway } from '../ports/AIGateway';
import { AggregatedData, AIAnalysisResult } from '../../shared/types/domain';
import { withRetry } from '../../infrastructure/google-api/retry';

/**
 * Use case: Free-form AI analysis of expense data.
 * Orchestrates: aggregated data → AIGateway → analysis result with chart.
 */
export class AnalyzeExpenses {
  constructor(private readonly ai: AIGateway) {}

  async execute(prompt: string, data: AggregatedData, apiKey: string): Promise<AIAnalysisResult> {
    return withRetry(() => this.ai.analyzeExpenses(prompt, data, apiKey));
  }
}
