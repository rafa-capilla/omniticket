import type { EmailGateway } from '@/application/ports/EmailGateway';
import type { AIGateway } from '@/application/ports/AIGateway';
import type { ExpenseRepository } from '@/application/ports/ExpenseRepository';
import type { CategoryRepository } from '@/application/ports/CategoryRepository';
import type { RuleRepository } from '@/application/ports/RuleRepository';
import type { ConfigRepository } from '@/application/ports/ConfigRepository';
import { withRetry } from '@/infrastructure/google-api/retry';
import type { SyncResult } from '@/shared/types/domain';
import { getErrorMessage } from '@/lib/utils';

interface SyncTicketsDeps {
  email: EmailGateway;
  ai: AIGateway;
  expenses: ExpenseRepository;
  categories: CategoryRepository;
  rules: RuleRepository;
  config: ConfigRepository;
}

/**
 * Use case: Synchronize tickets from Gmail → AI extraction → Sheets.
 * Orchestrates ports without knowing their concrete implementations.
 * Processing is sequential (one ticket at a time) by design.
 */
export class SyncTickets {
  constructor(private readonly deps: SyncTicketsDeps) {}

  async execute(onProgress?: (msg: string) => void): Promise<SyncResult[]> {
    const { email, ai, expenses, categories, rules, config } = this.deps;

    onProgress?.('Validando conexión con base de datos...');
    const spreadsheetId = await config.getOrFindId();
    const settings = await config.getSettings(spreadsheetId);

    onProgress?.('Cargando categorías y reglas...');
    const [cats, rls] = await Promise.all([
      categories.getCategories(spreadsheetId),
      rules.getRules(spreadsheetId),
    ]);

    const query = `label:${settings.GMAIL_SEARCH_LABEL} -label:${settings.GMAIL_PROCESSED_LABEL}`;
    onProgress?.('Buscando nuevos tickets en Gmail...');
    const threadIds = await email.searchThreads(query);

    if (threadIds.length === 0) {
      onProgress?.('Todo al día. No hay tickets pendientes.');
      await config.updateLastSync();
      return [];
    }

    const results: SyncResult[] = [];
    const total = threadIds.length;

    for (const [i, threadId] of threadIds.entries()) {
      const ticketNum = `(${i + 1}/${total})`;

      try {
        onProgress?.(`Leyendo email ${ticketNum}...`);
        const content = await email.getThreadContent(threadId);
        const ticketUuid = crypto.randomUUID();

        onProgress?.(`Analizando con Gemini ${ticketNum}...`);
        const ticketData = await withRetry(
          () => ai.extractTicketData(content, ticketUuid, settings.GEMINI_API_KEY, cats, rls),
        );

        onProgress?.(`Guardando en Sheets ${ticketNum}...`);
        await expenses.appendExpense(spreadsheetId, ticketData);

        await email.addLabelToThread(threadId, settings.GMAIL_PROCESSED_LABEL);

        results.push({ messageId: threadId, status: 'success' });
        onProgress?.(`✓ Ticket ${ticketNum}: ${ticketData.tienda} (${ticketData.fecha})`);
      } catch (error: unknown) {
        const msg = getErrorMessage(error);
        console.error(`Error en thread ${threadId}:`, error);
        results.push({ messageId: threadId, status: 'error', error: msg });
        onProgress?.(`✗ Ticket ${ticketNum}: ${msg}`);
        await new Promise(r => setTimeout(r, 500));
      }
    }

    await config.updateLastSync();

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
