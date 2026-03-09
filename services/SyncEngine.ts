
import { GoogleGenAI, Type } from "@google/genai";
import { GmailService } from "./GmailService";
import { SheetsService } from "./SheetsService";
import { ConfigService } from "./ConfigService";
import { ticketSchema } from "../schemas/ticketSchema";
import { withRetry } from "./retry";
import { SyncResult, OmniSettings, Category, Rule } from "../types";

/**
 * Motor de sincronización principal de OmniTicket.
 * Orquesta: Gmail → Gemini AI (extracción + normalización integrada) → Google Sheets
 * Procesamiento secuencial (1 ticket a la vez) para:
 * - Reducir alucinaciones en tickets grandes
 * - Marcar como "Procesado" solo los tickets que tuvieron éxito
 * - Llevar un conteo preciso de éxitos y errores
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

  async runSync(onProgress?: (msg: string) => void): Promise<SyncResult[]> {
    onProgress?.("Validando conexión con base de datos...");
    const spreadsheetId = await this.config.getOrFindId();
    const settings = await this.config.getSettings(spreadsheetId);

    onProgress?.("Cargando categorías y reglas...");
    const categories: Category[] = await this.sheets.getCategories(spreadsheetId);
    const rules: Rule[] = await this.sheets.getRules(spreadsheetId);

    const query = `label:${settings.GMAIL_SEARCH_LABEL} -label:${settings.GMAIL_PROCESSED_LABEL}`;
    onProgress?.("Buscando nuevos tickets en Gmail...");
    const threadIds = await this.gmail.searchThreads(query);

    if (threadIds.length === 0) {
      onProgress?.("Todo al día. No hay tickets pendientes.");
      await this.config.updateLastSync();
      return [];
    }

    const results: SyncResult[] = [];
    const total = threadIds.length;

    for (let i = 0; i < total; i++) {
      const threadId = threadIds[i];
      const ticketNum = `(${i + 1}/${total})`;

      try {
        onProgress?.(`Leyendo email ${ticketNum}...`);
        const content = await this.gmail.getThreadContent(threadId);
        const ticketUuid = crypto.randomUUID();

        onProgress?.(`Analizando con Gemini ${ticketNum}...`);
        const ticketData = await withRetry(
          () => this.extractDataWithAI(content, ticketUuid, settings, categories, rules),
        );

        onProgress?.(`Guardando en Sheets ${ticketNum}...`);
        await this.sheets.appendExpense(spreadsheetId, ticketData);

        // Solo se marca como procesado si todo fue bien
        await this.gmail.addLabelToThread(threadId, settings.GMAIL_PROCESSED_LABEL);

        results.push({ messageId: threadId, status: 'success' });
        onProgress?.(`✓ Ticket ${ticketNum}: ${ticketData.tienda} (${ticketData.fecha})`);
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`Error en thread ${threadId}:`, error);
        results.push({ messageId: threadId, status: 'error', error: msg });
        onProgress?.(`✗ Ticket ${ticketNum}: ${msg}`);
        // Pausa breve antes del siguiente para no saturar la API tras un error
        await new Promise(r => setTimeout(r, 500));
      }
    }

    await this.config.updateLastSync();

    const succeeded = results.filter(r => r.status === 'success').length;
    const failed = results.filter(r => r.status === 'error').length;
    if (failed === 0) {
      onProgress?.(`¡Sincronización completada! ${succeeded} ticket${succeeded !== 1 ? 's' : ''} procesado${succeeded !== 1 ? 's' : ''}.`);
    } else {
      onProgress?.(`Sync terminado: ${succeeded} OK, ${failed} con error.`);
    }

    return results;
  }

  /**
   * Extrae datos estructurados del email con Gemini AI.
   * Incluye normalización de nombres y categorización dinámica.
   * Aplica reglas del usuario como post-proceso (mayor prioridad que Gemini).
   */
  private async extractDataWithAI(
    emailContent: string,
    uuid: string,
    settings: OmniSettings,
    categories: Category[],
    rules: Rule[]
  ) {
    const apiKey = settings.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY no configurada en el Spreadsheet (Settings!B3). Por favor, configúrala en la hoja Settings.");
    }

    const activeCategories = categories.filter(c => c.status === 'active');
    const fallbackCategories = ['Lácteos', 'Carne', 'Fruta/Verdura', 'Limpieza', 'Bebidas', 'Higiene', 'Otros'];
    const categoriesToUse = activeCategories.length > 0
      ? activeCategories
      : fallbackCategories.map(name => ({ name, description: '', status: 'active' as const }));

    const categoryList = categoriesToUse
      .map(c => c.description ? `- ${c.name}: ${c.description}` : `- ${c.name}`)
      .join('\n');

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
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

    let ticketData;
    try {
      const rawJson = JSON.parse(response.text || "{}");
      rawJson.id = uuid; // always use our UUID
      ticketData = ticketSchema.parse(rawJson);
    } catch (e) {
      console.error("Fallo al parsear JSON de Gemini:", response.text, e);
      const detail = e instanceof Error ? e.message : String(e);
      throw new Error(`Datos de IA inválidos: ${detail}`);
    }

    // Post-process: apply user rules (highest priority)
    const activeCategoryNames = new Set(categoriesToUse.map(c => c.name));
    ticketData.items.forEach(item => {
      const match = rules.find(r =>
        r.pattern && item.nombre.toLowerCase().includes(r.pattern.toLowerCase())
      );
      if (match) {
        item.nombre_normalizado = match.normalized;
        item.categoria = match.category;
      }
      // Validate category — reassign to Otros if unknown
      if (!activeCategoryNames.has(item.categoria)) {
        item.categoria = 'Otros';
      }
    });

    return ticketData;
  }
}
