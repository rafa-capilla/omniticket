import { GoogleGenAI, Type } from "@google/genai";
import { ProductMapping } from "../types";
import { SheetsService } from "./SheetsService";

export class NormalizationService {
  constructor(
    private sheets: SheetsService, 
    private spreadsheetId: string,
    private apiKey: string
  ) {}

  async normalizeProducts(productNames: string[]): Promise<Map<string, string>> {
    const rules = await this.sheets.getRules(this.spreadsheetId);
    const existingMappings = await this.sheets.getMappings(this.spreadsheetId);
    
    const cacheMap = new Map<string, string>();
    existingMappings.forEach(m => cacheMap.set(String(m.original), String(m.simplificado)));

    const finalMap = new Map<string, string>();
    const pendingNames: string[] = [];

    productNames.forEach(name => {
      const n = String(name || '').trim();
      if (n === '--- TOTAL TICKET ---' || !n) return;

      const hasRule = rules.some(r => n.toLowerCase().includes(String(r.pattern || '').toLowerCase()));
      if (hasRule) return;

      if (cacheMap.has(n)) {
        finalMap.set(n, cacheMap.get(n)!);
        return;
      }

      pendingNames.push(n);
    });

    if (pendingNames.length === 0) return finalMap;

    const batch = pendingNames.slice(0, 30);
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: `Normaliza estos productos de supermercado a nombres genéricos breves (max 3 palabras).
        
        Lista:
        ${batch.join('\n')}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                original: { type: Type.STRING },
                simplificado: { type: Type.STRING }
              },
              required: ["original", "simplificado"]
            }
          }
        }
      });

      const newMappings: ProductMapping[] = JSON.parse(response.text || "[]");
      const sanitizedMappings = newMappings.map(m => ({
        original: String(m.original),
        simplificado: String(m.simplificado)
      }));

      const updatedCache = [...existingMappings, ...sanitizedMappings];
      await this.sheets.saveMappings(this.spreadsheetId, updatedCache);
      
      sanitizedMappings.forEach(m => finalMap.set(m.original, m.simplificado));
    } catch (e: any) {
      console.error("Error en normalización Gemini:", e);
      throw e;
    }

    return finalMap;
  }
}