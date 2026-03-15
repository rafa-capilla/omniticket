/**
 * Facade that delegates to GeminiGateway for backward compatibility.
 * @see infrastructure/google-api/GeminiGateway.ts
 */

import { AggregatedData, AIAnalysisResult } from "../types";
import { GeminiGateway } from '../infrastructure/google-api/GeminiGateway';

export class AIAnalysisService {
  private readonly gateway = new GeminiGateway();

  async analyze(prompt: string, data: AggregatedData, apiKey: string): Promise<AIAnalysisResult> {
    return this.gateway.analyzeExpenses(prompt, data, apiKey);
  }
}
