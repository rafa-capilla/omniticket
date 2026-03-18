import { GoogleGenAI, Type } from "@google/genai";
import type { TicketData, Category, Rule, AggregatedData, AIAnalysisResult } from '@/shared/types/domain';
import { analysisResultSchema } from '@/schemas/analysisSchema';
import { withRetry } from '@/infrastructure/google-api/retry';
import { getErrorMessage, getActiveCategories } from '@/lib/utils';
import { GEMINI_MODEL } from '@/lib/constants';
import { validateTicketData, recalculateLineTotals } from '@/domain/services/TicketValidator';
import { applyRulesToItems } from '@/domain/services/RuleEngine';
import type { AIGateway } from '@/application/ports/AIGateway';

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

    const dataContext = `DATOS DE GASTOS (período: ${data.period.start} a ${data.period.end}):
- Gasto total: ${data.totalSpent.toFixed(2)}€
- Tickets procesados: ${data.ticketCount}
- Ticket promedio: ${(data.totalSpent / Math.max(data.ticketCount, 1)).toFixed(2)}€

POR CATEGORÍA:
${data.byCategory.map(c => `- ${c.name}: ${c.total.toFixed(2)}€ (${c.percentage.toFixed(1)}%)`).join('\n')}

TOP 50 PRODUCTOS (por gasto total):
${data.byProduct.slice(0, 50).map(p => `- ${p.name}: ${p.total.toFixed(2)}€`).join('\n')}

POR TIENDA:
${data.byStore.map(s => `- ${s.name}: ${s.total.toFixed(2)}€`).join('\n')}`;

    const MAX_LINES = 500;
    const lineItemsSection = data.lineItems.length > 0
      ? `\n\nLÍNEAS DE GASTO INDIVIDUALES (${Math.min(data.lineItems.length, MAX_LINES)} de ${data.lineItems.length} filas):\nfecha|tienda|producto|categoría|cant|precio_unit|total\n${data.lineItems.slice(0, MAX_LINES).join('\n')}`
      : '';

    const ai = new GoogleGenAI({ apiKey });
    return withRetry(async () => {
      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `${prompt}\n\n${dataContext}${lineItemsSection}`,
        config: {
          systemInstruction: `Eres un experto en análisis de gastos de supermercado. Analiza los datos del usuario y responde a su consulta de forma concisa, útil y en español.
Genera también datos para un gráfico que ilustre tu análisis: elige 'pie' para distribuciones proporcionales o 'bar' para comparaciones de magnitud.
Los valores en chart_data deben ser numéricos (importes en euros). Incluye entre 3 y 8 elementos en chart_data.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysis_text: { type: Type.STRING },
              chart_type: { type: Type.STRING },
              chart_data: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    value: { type: Type.NUMBER }
                  },
                  required: ["name", "value"]
                }
              },
              chart_title: { type: Type.STRING }
            },
            required: ["analysis_text", "chart_type", "chart_data", "chart_title"]
          }
        }
      });

      const responseText = response.text ?? '';
      if (!responseText) {
        throw new Error("Gemini devolvió una respuesta vacía para el análisis");
      }
      try {
        const raw: unknown = JSON.parse(responseText);
        return analysisResultSchema.parse(raw);
      } catch (e) {
        if (e instanceof SyntaxError) {
          console.error("Error parsing AI analysis response (primeros 200 chars):", responseText.slice(0, 200));
          throw new Error("Respuesta de IA no es JSON válido");
        }
        throw e;
      }
    });
  }

  /** Calls Gemini AI to extract structured ticket data from email content. */
  private async callGeminiExtraction(
    apiKey: string,
    emailContent: string,
    uuid: string,
    categories: Category[]
  ): Promise<unknown> {
    const categoryList = categories
      .map(c => c.description ? `- ${c.name}: ${c.description}` : `- ${c.name}`)
      .join('\n');

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
        systemInstruction: `Eres un asistente experto en contabilidad. Tu tarea es extraer datos estructurados de tickets de compra (supermercados, tiendas, etc).
        REGLAS:
        1. Tienda: Nombre comercial limpio (sin direcciones ni códigos).
        2. Fecha: Formato YYYY-MM-DD. Si no hay año, asume el año actual.
        3. Items: Extrae cada línea de producto. Limpia nombres raros (ej: "PROD 250G" → "Producto 250g").
        4. Categorías permitidas (usa EXACTAMENTE estos nombres):
        ${categoryList}
        Si no estás seguro de la categoría, usa "Otros".
        5. Totales: Asegura que la suma de items coincida con total_ticket.
        6. Si hay descuentos, ponlos en el campo 'descuento' (valor positivo).
        7. nombre_normalizado: Para cada producto genera un nombre simplificado (máximo 3 palabras, sin códigos de producto, en Title Case). Ej: "COCA COLA ZERO 2L PET" → "Coca Cola Zero".`,
        responseMimeType: "application/json",
        responseSchema: {
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
                  precio_total_linea: { type: Type.NUMBER }
                },
                required: ["nombre", "nombre_normalizado", "categoria", "precio_unitario", "cantidad", "precio_total_linea"]
              }
            },
            total_ticket: { type: Type.NUMBER }
          },
          required: ["id", "tienda", "fecha", "items", "total_ticket"]
        }
      }
    });

    const responseText = response.text ?? '';
    if (!responseText) {
      throw new Error("Gemini devolvió una respuesta vacía para la extracción de ticket");
    }
    try {
      return JSON.parse(responseText);
    } catch (e: unknown) {
      console.error("Fallo al parsear JSON de Gemini (primeros 200 chars):", responseText.slice(0, 200), e);
      throw new Error(`Respuesta de Gemini no es JSON válido: ${getErrorMessage(e)}`);
    }
  }
}
