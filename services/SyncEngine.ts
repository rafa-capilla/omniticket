
import { GmailService } from "./GmailService";
import { SheetsService } from "./SheetsService";
import { ConfigService } from "./ConfigService";
import { withRetry } from "./retry";
import { GeminiGateway } from "../infrastructure/google-api/GeminiGateway";
import { SyncResult, Category, Rule } from "../types";
import { getErrorMessage } from "../lib/utils";

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
  private gemini: GeminiGateway;

  constructor(private accessToken: string) {
    this.gmail = new GmailService(accessToken);
    this.sheets = new SheetsService(accessToken);
    this.config = new ConfigService(accessToken);
    this.gemini = new GeminiGateway();
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

    for (const [i, threadId] of threadIds.entries()) {
      const ticketNum = `(${i + 1}/${total})`;

      try {
        onProgress?.(`Leyendo email ${ticketNum}...`);
        const content = await this.gmail.getThreadContent(threadId);
        const ticketUuid = crypto.randomUUID();

        onProgress?.(`Analizando con Gemini ${ticketNum}...`);
        const ticketData = await withRetry(
          () => this.gemini.extractTicketData(content, ticketUuid, settings.GEMINI_API_KEY, categories, rules),
        );

        onProgress?.(`Guardando en Sheets ${ticketNum}...`);
        await this.sheets.appendExpense(spreadsheetId, ticketData);

        // Solo se marca como procesado si todo fue bien
        await this.gmail.addLabelToThread(threadId, settings.GMAIL_PROCESSED_LABEL);

        results.push({ messageId: threadId, status: 'success' });
        onProgress?.(`✓ Ticket ${ticketNum}: ${ticketData.tienda} (${ticketData.fecha})`);
      } catch (error: unknown) {
        const msg = getErrorMessage(error);
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
}
