import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SyncTickets } from '../SyncTickets';
import type { EmailGateway } from '@/application/ports/EmailGateway';
import type { AIGateway } from '@/application/ports/AIGateway';
import type { ExpenseRepository } from '@/application/ports/ExpenseRepository';
import type { CategoryRepository } from '@/application/ports/CategoryRepository';
import type { RuleRepository } from '@/application/ports/RuleRepository';
import type { ConfigRepository } from '@/application/ports/ConfigRepository';
import type { TicketData, OmniSettings } from '@/shared/types/domain';
import { AuthExpiredError, RateLimitError } from '@/domain/errors';

// ─── Factories ──────────────────────────────────────────────────────────────

const SPREADSHEET_ID = 'sheet-123';

const DEFAULT_SETTINGS: OmniSettings = {
  GMAIL_SEARCH_LABEL: 'OmniTicket',
  GMAIL_PROCESSED_LABEL: 'OmniTicket/Procesado',
  GEMINI_API_KEY: 'test-key',
  LAST_SYNC: 'Nunca',
};

function makeTicket(overrides?: Partial<TicketData>): TicketData {
  return {
    id: 'uuid-1',
    tienda: 'Mercadona',
    fecha: '2025-01-15',
    items: [{
      nombre: 'Leche', categoria: 'Lácteos',
      precio_unitario: 1.20, cantidad: 1, descuento: 0, precio_total_linea: 1.20,
    }],
    total_ticket: 1.20,
    ...overrides,
  };
}

function createMockEmail(overrides?: Partial<EmailGateway>): EmailGateway {
  return {
    searchThreads: vi.fn<EmailGateway['searchThreads']>().mockResolvedValue([]),
    getThreadContent: vi.fn<EmailGateway['getThreadContent']>().mockResolvedValue('email content'),
    addLabelToThread: vi.fn<EmailGateway['addLabelToThread']>().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockAI(overrides?: Partial<AIGateway>): AIGateway {
  return {
    extractTicketData: vi.fn<AIGateway['extractTicketData']>().mockResolvedValue(makeTicket()),
    analyzeExpenses: vi.fn<AIGateway['analyzeExpenses']>().mockResolvedValue({
      analysis_text: '', chart_type: 'bar', chart_data: [], chart_title: '',
    }),
    ...overrides,
  };
}

function createMockExpenses(overrides?: Partial<ExpenseRepository>): ExpenseRepository {
  return {
    appendExpense: vi.fn<ExpenseRepository['appendExpense']>().mockResolvedValue(undefined),
    fetchAllLineItems: vi.fn<ExpenseRepository['fetchAllLineItems']>().mockResolvedValue([]),
    ...overrides,
  };
}

function createMockCategories(overrides?: Partial<CategoryRepository>): CategoryRepository {
  return {
    getCategories: vi.fn<CategoryRepository['getCategories']>().mockResolvedValue([
      { name: 'Lácteos', description: '', status: 'active' },
      { name: 'Otros', description: '', status: 'active' },
    ]),
    addCategory: vi.fn<CategoryRepository['addCategory']>().mockResolvedValue(undefined),
    updateCategory: vi.fn<CategoryRepository['updateCategory']>().mockResolvedValue(undefined),
    deleteCategory: vi.fn<CategoryRepository['deleteCategory']>().mockResolvedValue(undefined),
    updateCategoryInGastos: vi.fn<CategoryRepository['updateCategoryInGastos']>().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockRules(overrides?: Partial<RuleRepository>): RuleRepository {
  return {
    getRules: vi.fn<RuleRepository['getRules']>().mockResolvedValue([]),
    addRule: vi.fn<RuleRepository['addRule']>().mockResolvedValue(undefined),
    updateRule: vi.fn<RuleRepository['updateRule']>().mockResolvedValue(undefined),
    deleteRule: vi.fn<RuleRepository['deleteRule']>().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockConfig(overrides?: Partial<ConfigRepository>): ConfigRepository {
  return {
    getOrFindId: vi.fn<ConfigRepository['getOrFindId']>().mockResolvedValue(SPREADSHEET_ID),
    ensureDatabase: vi.fn<ConfigRepository['ensureDatabase']>().mockResolvedValue({
      settings: DEFAULT_SETTINGS, dbId: SPREADSHEET_ID,
    }),
    getSettings: vi.fn<ConfigRepository['getSettings']>().mockResolvedValue(DEFAULT_SETTINGS),
    updateSetting: vi.fn<ConfigRepository['updateSetting']>().mockResolvedValue(undefined),
    updateLastSync: vi.fn<ConfigRepository['updateLastSync']>().mockResolvedValue(undefined),
    ...overrides,
  };
}

interface MockDeps {
  email: EmailGateway;
  ai: AIGateway;
  expenses: ExpenseRepository;
  categories: CategoryRepository;
  rules: RuleRepository;
  config: ConfigRepository;
}

function createDeps(overrides?: Partial<MockDeps>): MockDeps {
  return {
    email: createMockEmail(),
    ai: createMockAI(),
    expenses: createMockExpenses(),
    categories: createMockCategories(),
    rules: createMockRules(),
    config: createMockConfig(),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('SyncTickets', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Stub crypto.randomUUID for deterministic tests
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-1' });
  });

  it('returns empty array and updates lastSync when no threads found', async () => {
    const deps = createDeps();
    const sync = new SyncTickets(deps);

    const results = await sync.execute();

    expect(results).toEqual([]);
    expect(deps.config.updateLastSync).toHaveBeenCalled();
  });

  it('processes a single ticket end-to-end', async () => {
    const deps = createDeps({
      email: createMockEmail({
        searchThreads: vi.fn<EmailGateway['searchThreads']>().mockResolvedValue(['thread-1']),
      }),
    });
    const sync = new SyncTickets(deps);

    const results = await sync.execute();

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ messageId: 'thread-1', status: 'success' });
    expect(deps.email.getThreadContent).toHaveBeenCalledWith('thread-1');
    expect(deps.ai.extractTicketData).toHaveBeenCalled();
    expect(deps.expenses.appendExpense).toHaveBeenCalledWith(SPREADSHEET_ID, expect.objectContaining({ tienda: 'Mercadona' }));
    expect(deps.email.addLabelToThread).toHaveBeenCalledWith('thread-1', 'OmniTicket/Procesado');
  });

  it('processes multiple tickets sequentially and returns results for each', async () => {
    const deps = createDeps({
      email: createMockEmail({
        searchThreads: vi.fn<EmailGateway['searchThreads']>().mockResolvedValue(['thread-1', 'thread-2', 'thread-3']),
      }),
    });
    const sync = new SyncTickets(deps);

    const results = await sync.execute();

    expect(results).toHaveLength(3);
    expect(results.every(r => r.status === 'success')).toBe(true);
    expect(deps.email.getThreadContent).toHaveBeenCalledTimes(3);
  });

  it('continues processing remaining tickets when one fails', async () => {
    const ticket1 = makeTicket({ id: 'uuid-1', tienda: 'Mercadona' });
    const ticket3 = makeTicket({ id: 'uuid-3', tienda: 'Lidl' });

    const deps = createDeps({
      email: createMockEmail({
        searchThreads: vi.fn<EmailGateway['searchThreads']>().mockResolvedValue(['t1', 't2', 't3']),
      }),
      ai: createMockAI({
        extractTicketData: vi.fn<AIGateway['extractTicketData']>()
          .mockResolvedValueOnce(ticket1)
          .mockRejectedValueOnce(new Error('Gemini parse error'))
          .mockResolvedValueOnce(ticket3),
      }),
    });
    const sync = new SyncTickets(deps);

    const results = await sync.execute();

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ messageId: 't1', status: 'success' });
    expect(results[1]).toEqual({ messageId: 't2', status: 'error', error: 'Gemini parse error' });
    expect(results[2]).toEqual({ messageId: 't3', status: 'success' });
    expect(deps.expenses.appendExpense).toHaveBeenCalledTimes(2);
  });

  it('does not add processed label when AI extraction fails', async () => {
    const deps = createDeps({
      email: createMockEmail({
        searchThreads: vi.fn<EmailGateway['searchThreads']>().mockResolvedValue(['thread-1']),
      }),
      ai: createMockAI({
        extractTicketData: vi.fn<AIGateway['extractTicketData']>().mockRejectedValue(new Error('bad JSON')),
      }),
    });
    const sync = new SyncTickets(deps);

    const results = await sync.execute();

    expect(results[0]!.status).toBe('error');
    expect(deps.email.addLabelToThread).not.toHaveBeenCalled();
    expect(deps.expenses.appendExpense).not.toHaveBeenCalled();
  });

  it('does not add processed label when expense saving fails', async () => {
    const deps = createDeps({
      email: createMockEmail({
        searchThreads: vi.fn<EmailGateway['searchThreads']>().mockResolvedValue(['thread-1']),
      }),
      expenses: createMockExpenses({
        appendExpense: vi.fn<ExpenseRepository['appendExpense']>().mockRejectedValue(new Error('Sheets error')),
      }),
    });
    const sync = new SyncTickets(deps);

    const results = await sync.execute();

    expect(results[0]!.status).toBe('error');
    expect(deps.email.addLabelToThread).not.toHaveBeenCalled();
  });

  it('constructs correct Gmail query from settings labels', async () => {
    const customSettings: OmniSettings = {
      ...DEFAULT_SETTINGS,
      GMAIL_SEARCH_LABEL: 'CustomLabel',
      GMAIL_PROCESSED_LABEL: 'CustomLabel/Done',
    };
    const deps = createDeps({
      config: createMockConfig({
        getOrFindId: vi.fn<ConfigRepository['getOrFindId']>().mockResolvedValue(SPREADSHEET_ID),
        getSettings: vi.fn<ConfigRepository['getSettings']>().mockResolvedValue(customSettings),
        updateLastSync: vi.fn<ConfigRepository['updateLastSync']>().mockResolvedValue(undefined),
      }),
    });
    const sync = new SyncTickets(deps);

    await sync.execute();

    expect(deps.email.searchThreads).toHaveBeenCalledWith('label:CustomLabel -label:CustomLabel/Done');
  });

  it('loads categories and rules in parallel before processing', async () => {
    const deps = createDeps({
      email: createMockEmail({
        searchThreads: vi.fn<EmailGateway['searchThreads']>().mockResolvedValue(['thread-1']),
      }),
    });
    const sync = new SyncTickets(deps);

    await sync.execute();

    expect(deps.categories.getCategories).toHaveBeenCalledWith(SPREADSHEET_ID);
    expect(deps.rules.getRules).toHaveBeenCalledWith(SPREADSHEET_ID);
  });

  it('always updates lastSync, even after mixed results', async () => {
    const deps = createDeps({
      email: createMockEmail({
        searchThreads: vi.fn<EmailGateway['searchThreads']>().mockResolvedValue(['t1', 't2']),
      }),
      ai: createMockAI({
        extractTicketData: vi.fn<AIGateway['extractTicketData']>()
          .mockResolvedValueOnce(makeTicket())
          .mockRejectedValueOnce(new Error('fail')),
      }),
    });
    const sync = new SyncTickets(deps);

    await sync.execute();

    expect(deps.config.updateLastSync).toHaveBeenCalled();
  });

  it('reports progress for each step', async () => {
    const deps = createDeps({
      email: createMockEmail({
        searchThreads: vi.fn<EmailGateway['searchThreads']>().mockResolvedValue(['thread-1']),
      }),
    });
    const sync = new SyncTickets(deps);
    const messages: string[] = [];

    await sync.execute(msg => messages.push(msg));

    expect(messages.some(m => m.includes('Validando conexión'))).toBe(true);
    expect(messages.some(m => m.includes('Buscando nuevos tickets'))).toBe(true);
    expect(messages.some(m => m.includes('Leyendo email'))).toBe(true);
    expect(messages.some(m => m.includes('Analizando con Gemini'))).toBe(true);
    expect(messages.some(m => m.includes('Guardando en Sheets'))).toBe(true);
    expect(messages.some(m => m.includes('Mercadona'))).toBe(true);
  });

  it('reports completion summary with counts', async () => {
    const deps = createDeps({
      email: createMockEmail({
        searchThreads: vi.fn<EmailGateway['searchThreads']>().mockResolvedValue(['t1', 't2']),
      }),
      ai: createMockAI({
        extractTicketData: vi.fn<AIGateway['extractTicketData']>()
          .mockResolvedValueOnce(makeTicket())
          .mockRejectedValueOnce(new Error('fail')),
      }),
    });
    const sync = new SyncTickets(deps);
    const messages: string[] = [];

    await sync.execute(msg => messages.push(msg));

    const summary = messages[messages.length - 1]!;
    expect(summary).toContain('1 OK');
    expect(summary).toContain('1 con error');
  });

  it('reports clean completion when all succeed', async () => {
    const deps = createDeps({
      email: createMockEmail({
        searchThreads: vi.fn<EmailGateway['searchThreads']>().mockResolvedValue(['t1']),
      }),
    });
    const sync = new SyncTickets(deps);
    const messages: string[] = [];

    await sync.execute(msg => messages.push(msg));

    const summary = messages[messages.length - 1]!;
    expect(summary).toContain('completada');
    expect(summary).toContain('1 ticket');
  });
});
