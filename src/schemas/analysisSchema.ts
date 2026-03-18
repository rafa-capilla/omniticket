import { z } from 'zod';

/**
 * Zod schema for validating the AI analysis response from Gemini.
 * Mirrors the responseSchema sent to the API, ensuring runtime type safety
 * on the response side — just as ticketSchema does for ticket extraction.
 *
 * Uses .pipe() and .coerce where needed because Gemini may return slightly
 * malformed data (e.g. string where number expected, null entries in arrays).
 */
/**
 * Coerces a Gemini chart value to number. Accepts:
 * - number: passed through (NaN → 0)
 * - string: parsed as float (unparseable → 0)
 * - null/undefined/other: falls back to 0
 */
const coerceChartValue = z.union([
  z.number(),
  z.string().transform((val): number => {
    const num = parseFloat(val);
    return Number.isNaN(num) ? 0 : num;
  }),
  z.null().transform((): number => 0),
  z.undefined().transform((): number => 0),
]).pipe(z.number().transform(n => Number.isNaN(n) ? 0 : n));

export const analysisChartItemSchema = z.object({
  name: z.string().default(''),
  value: coerceChartValue,
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
