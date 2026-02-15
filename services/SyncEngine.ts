
import { GoogleGenAI, Type } from "@google/genai";
import { GmailService } from "./GmailService";
import { SheetsService } from "./SheetsService";
import { ConfigService } from "./ConfigService";
import { ticketSchema } from "../schemas/ticketSchema";
import { SyncResult } from "../types";

/**
 * Motor de sincronización principal de OmniTicket.
 * Orquesta el proceso completo: Gmail → Gemini AI → Google Sheets
 *
 * Flujo:
 * 1. Busca emails en Gmail con label configurado (ej: "OmniTicket")
 * 2. Por cada email: extrae contenido, analiza con Gemini, valida con Zod
 * 3. Guarda líneas de ticket en Spreadsheet "Gastos"
 * 4. Marca email como procesado con label "OmniTicket/Procesado"
 */
export class SyncEngine {
  private gmail: GmailService;
  private sheets: SheetsService;
  private config: ConfigService;

  constructor(private accessToken: string) {
    this.gmail = new GmailService(accessToken);
    this.sheets = new SheetsService(accessToken);
    this.config = new ConfigService(accessToken);
  }

  /**
   * Ejecuta el proceso completo de sincronización de tickets desde Gmail.
   *
   * @param onProgress - Callback opcional para reportar progreso en tiempo real
   * @returns Array de resultados (success/error) por cada thread procesado
   * @throws Error si falla la conexión con APIs de Google
   */
  async runSync(onProgress?: (msg: string) => void): Promise<SyncResult[]> {
    onProgress?.("Validando conexión con base de datos...");
    const settings = await this.config.getSettings();
    const spreadsheetId = await this.config.getOrFindId();

    const query = `label:${settings.GMAIL_SEARCH_LABEL} -label:${settings.GMAIL_PROCESSED_LABEL}`;
    onProgress?.("Buscando nuevos tickets en Gmail...");
    const threadIds = await this.gmail.searchThreads(query);

    if (threadIds.length === 0) {
      onProgress?.("Todo al día. No hay tickets pendientes.");
      await new Promise(r => setTimeout(r, 1500));
      await this.config.updateLastSync();
      return [];
    }

    const results: SyncResult[] = [];
    let count = 1;
    for (const threadId of threadIds) {
      try {
        onProgress?.(`Procesando ticket ${count} de ${threadIds.length}...`);
        const content = await this.gmail.getThreadContent(threadId);
        const ticketUuid = crypto.randomUUID();
        
        onProgress?.(`Analizando con Gemini Pro (${count}/${threadIds.length})...`);
        const ticketData = await this.extractDataWithAI(content, ticketUuid);
        
        onProgress?.(`Guardando datos en Sheets...`);
        await this.sheets.appendExpense(spreadsheetId, ticketData);
        await this.gmail.addLabelToThread(threadId, settings.GMAIL_PROCESSED_LABEL);
        
        results.push({ messageId: threadId, status: 'success' });
        count++;
      } catch (error: any) {
        console.error(`Error en thread ${threadId}:`, error);
        results.push({ messageId: threadId, status: 'error', error: String(error.message || error) });
      }
    }

    await this.config.updateLastSync();
    onProgress?.("¡Sincronización exitosa!");
    return results;
  }

  /**
   * Extrae datos estructurados de un email de ticket usando Gemini AI.
   *
   * @param emailContent - Contenido raw del email (HTML + texto)
   * @param uuid - UUID único para identificar el ticket
   * @returns TicketData validado con Zod schema
   * @throws Error si Gemini falla o el JSON no pasa validación
   */
  private async extractDataWithAI(emailContent: string, uuid: string) {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: `Analiza el contenido de este email y extrae los datos del ticket de compra. 
      UUID para el ticket: ${uuid}
      
      CONTENIDO DEL EMAIL:
      ---
      ${emailContent}
      ---`,
      config: {
        systemInstruction: `Eres un asistente experto en contabilidad. Tu tarea es extraer datos estructurados de tickets de compra (supermercados, tiendas, etc).
        REGLAS:
        1. Tienda: Nombre comercial limpio.
        2. Fecha: Formato YYYY-MM-DD. Si no hay año, asume 2024 o 2025.
        3. Items: Extrae cada línea de producto. Limpia nombres raros (ej: "PROD 250G" -> "Producto 250g").
        4. Categorías permitidas: Lácteos, Carne, Fruta/Verdura, Limpieza, Bebidas, Higiene, Otros.
        5. Totales: Asegura que la suma de items coincida con el total_ticket.
        6. Si hay descuentos, añádelos en el campo 'descuento' (valor positivo).`,
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
                  categoria: { type: Type.STRING },
                  precio_unitario: { type: Type.NUMBER },
                  cantidad: { type: Type.NUMBER },
                  descuento: { type: Type.NUMBER },
                  precio_total_linea: { type: Type.NUMBER }
                },
                required: ["nombre", "categoria", "precio_unitario", "cantidad", "precio_total_linea"]
              }
            },
            total_ticket: { type: Type.NUMBER }
          },
          required: ["id", "tienda", "fecha", "items", "total_ticket"]
        }
      }
    });
    
    try {
      const rawJson = JSON.parse(response.text || "{}");
      return ticketSchema.parse(rawJson);
    } catch (e) {
      console.error("Fallo al parsear JSON de Gemini:", response.text);
      throw new Error("Datos de IA inválidos");
    }
  }
}
