import { z } from 'zod';

/**
 * Zod schema for validating the AI analysis response from Gemini.
 * Mirrors the responseSchema sent to the API, ensuring runtime type safety
 * on the response side — just as ticketSchema does for ticket extraction.
 *
 * Uses .pipe() and .coerce where needed because Gemini may return slightly
 * malformed data (e.g. string where number expected, null entries in arrays).
 */
export const analysisChartItemSchema = z.object({
  name: z.string().default(''),
  value: z.unknown().transform((val): number => {
    if (typeof val === 'number' && !Number.isNaN(val)) return val;
    const num = Number(val);
    return Number.isNaN(num) ? 0 : num;
  }),
});

export const analysisResultSchema = z.object({
  analysis_text: z.string().min(1, 'La respuesta de IA no contiene texto de análisis'),
  chart_type: z
    .string()
    .transform((val): 'pie' | 'bar' => (val === 'pie' ? 'pie' : 'bar')),
  chart_data: z
    .unknown()
    .transform((val): unknown[] => (Array.isArray(val) ? val.filter((v): v is object => v != null && typeof v === 'object') : []))
    .pipe(z.array(analysisChartItemSchema)),
  chart_title: z.string().default(''),
});
