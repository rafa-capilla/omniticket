import { GoogleGenAI, Type } from "@google/genai";
import { AggregatedData, AIAnalysisResult } from "../types";
import { withRetry } from "./retry";

/**
 * Servicio de análisis libre de gastos usando Gemini AI.
 * Recibe un prompt del usuario y datos agregados (no filas raw),
 * y devuelve un análisis en texto + datos para un gráfico dinámico.
 */
export class AIAnalysisService {
  async analyze(prompt: string, data: AggregatedData, apiKey: string): Promise<AIAnalysisResult> {
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

    return withRetry(async () => {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
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

      try {
        const result = JSON.parse(response.text || "{}");
        if (result.chart_type !== 'pie' && result.chart_type !== 'bar') {
          result.chart_type = 'bar';
        }
        return result as AIAnalysisResult;
      } catch (e) {
        console.error("Error parsing AI analysis response:", response.text);
        throw new Error("Respuesta de IA inválida");
      }
    });
  }
}
