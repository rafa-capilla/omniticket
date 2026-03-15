/**
 * Facade that delegates to the AnalyzeExpenses use case for backward compatibility.
 * @see application/use-cases/AnalyzeExpenses.ts
 */

import { AggregatedData, AIAnalysisResult } from "../types";
import { GeminiGateway } from '../infrastructure/google-api/GeminiGateway';
import { AnalyzeExpenses } from '../application/use-cases/AnalyzeExpenses';

export class AIAnalysisService {
  private readonly useCase = new AnalyzeExpenses(new GeminiGateway());

  async analyze(prompt: string, data: AggregatedData, apiKey: string): Promise<AIAnalysisResult> {
    return this.useCase.execute(prompt, data, apiKey);
  }
}
