import { GoogleGenAI, Type } from "@google/genai";
import type { TicketData, Category, Rule, AggregatedData, AIAnalysisResult } from '@/shared/types/domain';
import { analysisResultSchema } from '@/schemas/analysisSchema';
import { withRetry } from '@/infrastructure/google-api/retry';
import { getErrorMessage, getActiveCategories } from '@/lib/utils';
import { GEMINI_MODEL } from '@/lib/constants';
import { validateTicketData, recalculateLineTotals } from '@/domain/services/TicketValidator';
import { applyRulesToItems } from '@/domain/services/RuleEngine';
import type { AIGateway } from '@/application/ports/AIGateway';

// ─── Response schemas (static, shared across all calls) ─────────────────────

const ANALYSIS_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    analysis_text: { type: Type.STRING },
    chart_type: { type: Type.STRING },
    chart_data: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { name: { type: Type.STRING }, value: { type: Type.NUMBER } },
        required: ["name", "value"] as const,
      },
    },
    chart_title: { type: Type.STRING },
  },
  required: ["analysis_text", "chart_type", "chart_data", "chart_title"] as const,
} as const;

const EXTRACTION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING },
    tienda: { type: Type.STRING },
    fecha: { type: Type.STRING },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          nombre: { type: Type.STRING },
          nombre_normalizado: { type: Type.STRING },
          categoria: { type: Type.STRING },
          precio_unitario: { type: Type.NUMBER },
          cantidad: { type: Type.NUMBER },
          descuento: { type: Type.NUMBER },
          precio_total_linea: { type: Type.NUMBER },
        },
        required: ["nombre", "nombre_normalizado", "categoria", "precio_unitario", "cantidad", "precio_total_linea"] as const,
      },
    },
    total_ticket: { type: Type.NUMBER },
  },
  required: ["id", "tienda", "fecha", "items", "total_ticket"] as const,
} as const;

// ─── Prompt builders ────────────────────────────────────────────────────────

const MAX_LINE_ITEMS = 500;

function buildExpenseContext(data: AggregatedData): string {
  const avgTicket = (data.totalSpent / Math.max(data.ticketCount, 1)).toFixed(2);

  const sections = [
    `DATOS DE GASTOS (período: ${data.period.start} a ${data.period.end}):`,
    `- Gasto total: ${data.totalSpent.toFixed(2)}€`,
    `- Tickets procesados: ${data.ticketCount}`,
    `- Ticket promedio: ${avgTicket}€`,
    '',
    'POR CATEGORÍA:',
    ...data.byCategory.map(c => `- ${c.name}: ${c.total.toFixed(2)}€ (${c.percentage.toFixed(1)}%)`),
    '',
    'TOP 50 PRODUCTOS (por gasto total):',
    ...data.byProduct.slice(0, 50).map(p => `- ${p.name}: ${p.total.toFixed(2)}€`),
    '',
    'POR TIENDA:',
    ...data.byStore.map(s => `- ${s.name}: ${s.total.toFixed(2)}€`),
  ];

  if (data.lineItems.length > 0) {
    const count = Math.min(data.lineItems.length, MAX_LINE_ITEMS);
    sections.push(
      '',
      `LÍNEAS DE GASTO INDIVIDUALES (${count} de ${data.lineItems.length} filas):`,
      'fecha|tienda|producto|categoría|cant|precio_unit|total',
      ...data.lineItems.slice(0, MAX_LINE_ITEMS),
    );
  }

  return sections.join('\n');
}

function buildCategoryList(categories: Category[]): string {
  return categories
    .map(c => c.description ? `- ${c.name}: ${c.description}` : `- ${c.name}`)
    .join('\n');
}

function buildExtractionSystemPrompt(categoryList: string): string {
  return `Eres un asistente experto en contabilidad. Tu tarea es extraer datos estructurados de tickets de compra (supermercados, tiendas, etc).
        REGLAS:
        1. Tienda: Nombre comercial limpio (sin direcciones ni códigos).
        2. Fecha: Formato YYYY-MM-DD. Si no hay año, asume el año actual.
        3. Items: Extrae cada línea de producto. Limpia nombres raros (ej: "PROD 250G" → "Producto 250g").
        4. Categorías permitidas (usa EXACTAMENTE estos nombres):
        ${categoryList}
        Si no estás seguro de la categoría, usa "Otros".
        5. Totales: Asegura que la suma de items coincida con total_ticket.
        6. Si hay descuentos, ponlos en el campo 'descuento' (valor positivo).
        7. nombre_normalizado: Para cada producto genera un nombre simplificado (máximo 3 palabras, sin códigos de producto, en Title Case). Ej: "COCA COLA ZERO 2L PET" → "Coca Cola Zero".`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Exported for unit testing. */
export function parseGeminiJsonResponse(responseText: string, context: string): unknown {
  if (!responseText) {
    throw new Error(`Gemini devolvió una respuesta vacía para ${context}`);
  }
  try {
    return JSON.parse(responseText);
  } catch (e: unknown) {
    console.error(`Fallo al parsear JSON de Gemini en ${context} (primeros 200 chars):`, responseText.slice(0, 200), e);
    throw new Error(`Respuesta de Gemini no es JSON válido: ${getErrorMessage(e)}`);
  }
}

// ─── Gateway ────────────────────────────────────────────────────────────────

/**
 * Implements AIGateway using Google Gemini AI.
 * Handles both ticket data extraction and free-form expense analysis.
 */
export class GeminiGateway implements AIGateway {
  async extractTicketData(
    emailContent: string,
    uuid: string,
    apiKey: string,
    categories: Category[],
    rules: Rule[],
  ): Promise<TicketData> {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY no configurada en el Spreadsheet (Settings!B3). Por favor, configúrala en la hoja Settings.");
    }

    const categoriesToUse = getActiveCategories(categories);
    const rawJson = await this.callGeminiExtraction(apiKey, emailContent, uuid, categoriesToUse);
    const ticketData = validateTicketData(rawJson, uuid);
    recalculateLineTotals(ticketData);
    applyRulesToItems(ticketData.items, rules, categoriesToUse);

    return ticketData;
  }

  async analyzeExpenses(
    prompt: string,
    data: AggregatedData,
    apiKey: string,
  ): Promise<AIAnalysisResult> {
    if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");

    const context = buildExpenseContext(data);
    const ai = new GoogleGenAI({ apiKey });

    return withRetry(async () => {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `${prompt}\n\n${context}`,
        config: {
          systemInstruction: `Eres un experto en análisis de gastos de supermercado. Analiza los datos del usuario y responde a su consulta de forma concisa, útil y en español.
Genera también datos para un gráfico que ilustre tu análisis: elige 'pie' para distribuciones proporcionales o 'bar' para comparaciones de magnitud.
Los valores en chart_data deben ser numéricos (importes en euros). Incluye entre 3 y 8 elementos en chart_data.`,
          responseMimeType: "application/json",
          responseSchema: ANALYSIS_RESPONSE_SCHEMA,
        },
      });

      const raw = parseGeminiJsonResponse(response.text ?? '', 'el análisis');
      return analysisResultSchema.parse(raw);
    });
  }

  private async callGeminiExtraction(
    apiKey: string,
    emailContent: string,
    uuid: string,
    categories: Category[],
  ): Promise<unknown> {
    const categoryList = buildCategoryList(categories);
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Analiza el contenido de este email y extrae los datos del ticket de compra.
      UUID para el ticket: ${uuid}

      CONTENIDO DEL EMAIL:
      ---
      ${emailContent}
      ---`,
      config: {
        systemInstruction: buildExtractionSystemPrompt(categoryList),
        responseMimeType: "application/json",
        responseSchema: EXTRACTION_RESPONSE_SCHEMA,
      },
    });

    return parseGeminiJsonResponse(response.text ?? '', 'la extracción de ticket');
  }
}
