import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockGenerateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: function GoogleGenAI() {
    return { models: { generateContent: mockGenerateContent } };
  },
  Type: {
    OBJECT: 'OBJECT',
    STRING: 'STRING',
    NUMBER: 'NUMBER',
    ARRAY: 'ARRAY',
  },
}));

vi.mock('../retry', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

import { AIAnalysisService } from '../AIAnalysisService';
import type { AggregatedData } from '@/shared/types/domain';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const API_KEY = 'test-gemini-key';

function makeAggregatedData(overrides?: Partial<AggregatedData>): AggregatedData {
  return {
    period: { start: '2025-01-01', end: '2025-01-31' },
    totalSpent: 150.0,
    ticketCount: 5,
    byCategory: [
      { name: 'Bebidas', total: 50, percentage: 33.3 },
      { name: 'Otros', total: 100, percentage: 66.7 },
    ],
    byProduct: [
      { name: 'Coca Cola', total: 30 },
      { name: 'Leche', total: 20 },
    ],
    byStore: [
      { name: 'Mercadona', total: 100 },
      { name: 'Lidl', total: 50 },
    ],
    lineItems: [],
    ...overrides,
  };
}

function makeGeminiResponse(data: Record<string, unknown>) {
  return { text: JSON.stringify(data) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── AIAnalysisService.analyze ───────────────────────────────────────────────

describe('AIAnalysisService.analyze', () => {
  it('throws when API key is empty', async () => {
    const svc = new AIAnalysisService();
    await expect(svc.analyze('test prompt', makeAggregatedData(), '')).rejects.toThrow(
      'GEMINI_API_KEY no configurada'
    );
  });

  it('calls Gemini generateContent when API key is provided', async () => {
    mockGenerateContent.mockResolvedValue(
      makeGeminiResponse({
        analysis_text: 'Test analysis',
        chart_type: 'bar',
        chart_data: [{ name: 'A', value: 10 }],
        chart_title: 'Test Chart',
      })
    );

    const svc = new AIAnalysisService();
    await svc.analyze('test', makeAggregatedData(), API_KEY);

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(mockGenerateContent.mock.calls[0]![0].model).toBe('gemini-2.5-pro');
  });

  it('returns a valid AIAnalysisResult for a well-formed Gemini response', async () => {
    mockGenerateContent.mockResolvedValue(
      makeGeminiResponse({
        analysis_text: 'Gastas mucho en bebidas.',
        chart_type: 'pie',
        chart_data: [
          { name: 'Bebidas', value: 50 },
          { name: 'Otros', value: 100 },
        ],
        chart_title: 'Distribución de Gastos',
      })
    );

    const svc = new AIAnalysisService();
    const result = await svc.analyze('Analiza mis gastos', makeAggregatedData(), API_KEY);

    expect(result.analysis_text).toBe('Gastas mucho en bebidas.');
    expect(result.chart_type).toBe('pie');
    expect(result.chart_data).toEqual([
      { name: 'Bebidas', value: 50 },
      { name: 'Otros', value: 100 },
    ]);
    expect(result.chart_title).toBe('Distribución de Gastos');
  });

  it('defaults chart_type to "bar" when response provides unknown type', async () => {
    mockGenerateContent.mockResolvedValue(
      makeGeminiResponse({
        analysis_text: 'Analysis text',
        chart_type: 'scatter',
        chart_data: [{ name: 'A', value: 1 }],
        chart_title: 'Title',
      })
    );

    const svc = new AIAnalysisService();
    const result = await svc.analyze('test', makeAggregatedData(), API_KEY);

    expect(result.chart_type).toBe('bar');
  });

  it('handles malformed chart_data entries (missing fields get defaults, nulls filtered)', async () => {
    mockGenerateContent.mockResolvedValue(
      makeGeminiResponse({
        analysis_text: 'Analysis',
        chart_type: 'bar',
        chart_data: [
          { name: 'Valid', value: 10 },
          { value: 20 },           // missing name → defaults to ''
          { name: 'NoValue' },     // missing value → defaults to 0
          null,                    // null entry → filtered out
          { name: 'Also Valid', value: 5 },
        ],
        chart_title: 'Title',
      })
    );

    const svc = new AIAnalysisService();
    const result = await svc.analyze('test', makeAggregatedData(), API_KEY);

    expect(result.chart_data).toHaveLength(4); // null filtered, rest get defaults
    expect(result.chart_data[0]).toEqual({ name: 'Valid', value: 10 });
    expect(result.chart_data[3]).toEqual({ name: 'Also Valid', value: 5 });
  });

  it('coerces non-numeric chart_data values to 0', async () => {
    mockGenerateContent.mockResolvedValue(
      makeGeminiResponse({
        analysis_text: 'Analysis',
        chart_type: 'bar',
        chart_data: [{ name: 'Item', value: 'not a number' }],
        chart_title: 'Title',
      })
    );

    const svc = new AIAnalysisService();
    const result = await svc.analyze('test', makeAggregatedData(), API_KEY);

    expect(result.chart_data[0]!.value).toBe(0);
  });

  it('throws when analysis_text is empty', async () => {
    mockGenerateContent.mockResolvedValue(
      makeGeminiResponse({
        analysis_text: '',
        chart_type: 'bar',
        chart_data: [{ name: 'A', value: 1 }],
        chart_title: 'Title',
      })
    );

    const svc = new AIAnalysisService();
    await expect(svc.analyze('test', makeAggregatedData(), API_KEY)).rejects.toThrow(
      'La respuesta de IA no contiene texto de análisis'
    );
  });

  it('throws descriptive error when Gemini returns invalid JSON', async () => {
    mockGenerateContent.mockResolvedValue({ text: 'not json {{{' });

    const svc = new AIAnalysisService();
    await expect(svc.analyze('test', makeAggregatedData(), API_KEY)).rejects.toThrow(
      'Respuesta de Gemini no es JSON válido'
    );
  });

  it('handles null response.text gracefully', async () => {
    mockGenerateContent.mockResolvedValue({ text: null });

    const svc = new AIAnalysisService();
    await expect(svc.analyze('test', makeAggregatedData(), API_KEY)).rejects.toThrow(
      'Gemini devolvió una respuesta vacía para el análisis'
    );
  });

  it('returns empty chart_data array when chart_data is not an array', async () => {
    mockGenerateContent.mockResolvedValue(
      makeGeminiResponse({
        analysis_text: 'Analysis',
        chart_type: 'pie',
        chart_data: 'not an array',
        chart_title: 'Title',
      })
    );

    const svc = new AIAnalysisService();
    const result = await svc.analyze('test', makeAggregatedData(), API_KEY);

    expect(result.chart_data).toEqual([]);
  });

  it('includes line items in context when provided', async () => {
    mockGenerateContent.mockResolvedValue(
      makeGeminiResponse({
        analysis_text: 'Analysis with lines',
        chart_type: 'bar',
        chart_data: [{ name: 'A', value: 1 }],
        chart_title: 'Title',
      })
    );

    const data = makeAggregatedData({
      lineItems: ['2025-01-01|Mercadona|Leche|Lácteos|1|1.20€|1.20€'],
    });

    const svc = new AIAnalysisService();
    await svc.analyze('test', data, API_KEY);

    const callArgs = mockGenerateContent.mock.calls[0]![0];
    expect(callArgs.contents).toContain('LÍNEAS DE GASTO INDIVIDUALES');
    expect(callArgs.contents).toContain('Mercadona');
  });

  it('limits line items to 500 rows', async () => {
    mockGenerateContent.mockResolvedValue(
      makeGeminiResponse({
        analysis_text: 'Analysis',
        chart_type: 'bar',
        chart_data: [{ name: 'A', value: 1 }],
        chart_title: 'Title',
      })
    );

    const lineItems = Array.from({ length: 600 }, (_, i) => `line-${i}`);
    const data = makeAggregatedData({ lineItems });

    const svc = new AIAnalysisService();
    await svc.analyze('test', data, API_KEY);

    const callArgs = mockGenerateContent.mock.calls[0]![0];
    expect(callArgs.contents).toContain('500 de 600 filas');
    expect(callArgs.contents).not.toContain('line-500');
  });

  it('includes aggregated data context in the Gemini prompt', async () => {
    mockGenerateContent.mockResolvedValue(
      makeGeminiResponse({
        analysis_text: 'Analysis',
        chart_type: 'bar',
        chart_data: [{ name: 'A', value: 1 }],
        chart_title: 'Title',
      })
    );

    const svc = new AIAnalysisService();
    await svc.analyze('Mi pregunta', makeAggregatedData(), API_KEY);

    const callArgs = mockGenerateContent.mock.calls[0]![0];
    expect(callArgs.contents).toContain('Mi pregunta');
    expect(callArgs.contents).toContain('150.00€');
    expect(callArgs.contents).toContain('Bebidas');
    expect(callArgs.contents).toContain('Mercadona');
  });
});
