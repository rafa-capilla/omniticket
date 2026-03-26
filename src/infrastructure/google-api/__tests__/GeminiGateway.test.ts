import { describe, it, expect } from 'vitest';
import { parseGeminiJsonResponse } from '../GeminiGateway';

describe('parseGeminiJsonResponse', () => {
  it('parses valid JSON and returns the parsed object', () => {
    const input = '{"tienda": "Mercadona", "total_ticket": 25.50}';
    const result = parseGeminiJsonResponse(input, 'test');

    expect(result).toEqual({ tienda: 'Mercadona', total_ticket: 25.50 });
  });

  it('parses a JSON array', () => {
    const input = '[1, 2, 3]';
    const result = parseGeminiJsonResponse(input, 'test');

    expect(result).toEqual([1, 2, 3]);
  });

  it('throws on empty string with descriptive message', () => {
    expect(() => parseGeminiJsonResponse('', 'la extracción')).toThrow(
      'Gemini devolvió una respuesta vacía para la extracción',
    );
  });

  it('throws on invalid JSON with descriptive message', () => {
    expect(() => parseGeminiJsonResponse('not json {', 'el análisis')).toThrow(
      'Respuesta de Gemini no es JSON válido',
    );
  });

  it('throws on truncated JSON', () => {
    expect(() => parseGeminiJsonResponse('{"tienda": "Merc', 'test')).toThrow(
      'Respuesta de Gemini no es JSON válido',
    );
  });

  it('parses valid JSON string primitives', () => {
    const result = parseGeminiJsonResponse('"hello"', 'test');
    expect(result).toBe('hello');
  });

  it('parses valid JSON number primitives', () => {
    const result = parseGeminiJsonResponse('42', 'test');
    expect(result).toBe(42);
  });

  it('parses null JSON', () => {
    const result = parseGeminiJsonResponse('null', 'test');
    expect(result).toBeNull();
  });
});
