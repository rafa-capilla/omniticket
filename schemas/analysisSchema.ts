import { z } from 'zod';

/**
 * Zod schema for validating the AI analysis response from Gemini.
 * Mirrors the responseSchema sent to the API, ensuring runtime type safety
 * on the response side — just as ticketSchema does for ticket extraction.
 */
export const analysisChartItemSchema = z.object({
  name: z.string().default(''),
  value: z.number().default(0),
});

export const analysisResultSchema = z.object({
  analysis_text: z.string().min(1, 'La respuesta de IA no contiene texto de análisis'),
  chart_type: z
    .string()
    .transform((val): 'pie' | 'bar' => (val === 'pie' ? 'pie' : 'bar')),
  chart_data: z.array(analysisChartItemSchema).default([]),
  chart_title: z.string().default(''),
});
