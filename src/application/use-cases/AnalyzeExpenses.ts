import type { AIGateway } from '@/application/ports/AIGateway';
import type { AggregatedData, AIAnalysisResult } from '@/shared/types/domain';

/**
 * Use case: Free-form AI analysis of expense data.
 * Orchestrates: aggregated data → AIGateway → analysis result with chart.
 *
 * Note: Retry logic lives inside the AIGateway implementation (GeminiGateway),
 * not here — applying withRetry at both layers would compound retries (up to 9 attempts).
 */
export class AnalyzeExpenses {
  constructor(private readonly ai: AIGateway) {}

  async execute(prompt: string, data: AggregatedData, apiKey: string): Promise<AIAnalysisResult> {
    return this.ai.analyzeExpenses(prompt, data, apiKey);
  }
}
