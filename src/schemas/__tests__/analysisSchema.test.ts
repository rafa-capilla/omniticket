import { describe, it, expect } from 'vitest';
import { analysisChartItemSchema, analysisResultSchema } from '../analysisSchema';

// ─── analysisChartItemSchema ────────────────────────────────────────────────

describe('analysisChartItemSchema', () => {
  it('accepts a valid chart item with number value', () => {
    const result = analysisChartItemSchema.parse({ name: 'Bebidas', value: 42.5 });
    expect(result).toEqual({ name: 'Bebidas', value: 42.5 });
  });

  it('coerces a string value to number', () => {
    const result = analysisChartItemSchema.parse({ name: 'Bebidas', value: '42.5' });
    expect(result).toEqual({ name: 'Bebidas', value: 42.5 });
  });

  it('coerces null value to 0', () => {
    const result = analysisChartItemSchema.parse({ name: 'Bebidas', value: null });
    expect(result).toEqual({ name: 'Bebidas', value: 0 });
  });

  it('coerces undefined value to 0', () => {
    const result = analysisChartItemSchema.parse({ name: 'Bebidas', value: undefined });
    expect(result).toEqual({ name: 'Bebidas', value: 0 });
  });

  it('coerces non-numeric string to 0', () => {
    const result = analysisChartItemSchema.parse({ name: 'X', value: 'hello' });
    expect(result).toEqual({ name: 'X', value: 0 });
  });

  it('defaults name to empty string when missing', () => {
    const result = analysisChartItemSchema.parse({ value: 10 });
    expect(result.name).toBe('');
  });

  it('rejects NaN value (NaN is not valid JSON, so Gemini cannot produce it)', () => {
    expect(() => analysisChartItemSchema.parse({ name: 'X', value: NaN })).toThrow();
  });

  it('handles zero value', () => {
    const result = analysisChartItemSchema.parse({ name: 'X', value: 0 });
    expect(result).toEqual({ name: 'X', value: 0 });
  });

  it('handles negative number', () => {
    const result = analysisChartItemSchema.parse({ name: 'X', value: -5.5 });
    expect(result).toEqual({ name: 'X', value: -5.5 });
  });
});

// ─── analysisResultSchema ──────────────────────────────────────────────────

describe('analysisResultSchema', () => {
  const validResult = {
    analysis_text: 'Tu mayor gasto es en Bebidas.',
    chart_type: 'pie',
    chart_data: [
      { name: 'Bebidas', value: 50 },
      { name: 'Lácteos', value: 30 },
    ],
    chart_title: 'Distribución de gastos',
  };

  it('accepts a fully valid result', () => {
    const result = analysisResultSchema.parse(validResult);
    expect(result.analysis_text).toBe('Tu mayor gasto es en Bebidas.');
    expect(result.chart_type).toBe('pie');
    expect(result.chart_data).toHaveLength(2);
    expect(result.chart_title).toBe('Distribución de gastos');
  });

  it('defaults unknown chart_type to "bar"', () => {
    const result = analysisResultSchema.parse({ ...validResult, chart_type: 'scatter' });
    expect(result.chart_type).toBe('bar');
  });

  it('rejects empty analysis_text', () => {
    expect(() => analysisResultSchema.parse({ ...validResult, analysis_text: '' })).toThrow();
  });

  it('filters null entries from chart_data array', () => {
    const result = analysisResultSchema.parse({
      ...validResult,
      chart_data: [{ name: 'A', value: 10 }, null, { name: 'B', value: 20 }],
    });
    expect(result.chart_data).toHaveLength(2);
  });

  it('handles non-array chart_data gracefully', () => {
    const result = analysisResultSchema.parse({
      ...validResult,
      chart_data: 'not an array',
    });
    expect(result.chart_data).toEqual([]);
  });

  it('defaults chart_title to empty string when missing', () => {
    const { chart_title: _, ...withoutTitle } = validResult;
    const result = analysisResultSchema.parse(withoutTitle);
    expect(result.chart_title).toBe('');
  });
});
