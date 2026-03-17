import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock instances ──────────────────────────────────────────────────────────

const mockGmail = {
  searchThreads: vi.fn().mockResolvedValue([]),
  getThreadContent: vi.fn().mockResolvedValue('email content'),
  addLabelToThread: vi.fn().mockResolvedValue(undefined),
};

const mockCategories = {
  getCategories: vi.fn(),
};

const mockRules = {
  getRules: vi.fn(),
};

const mockExpenses = {
  appendExpense: vi.fn().mockResolvedValue(undefined),
};

const mockConfig = {
  getOrFindId: vi.fn().mockResolvedValue('spreadsheet-123'),
  getSettings: vi.fn(),
  updateLastSync: vi.fn().mockResolvedValue(undefined),
};

// ─── Module mocks (use function keyword for new-ability) ─────────────────────

vi.mock('@/infrastructure/google-api/GmailGateway', () => ({
  GmailGateway: function GmailGateway() { return mockGmail; },
}));
vi.mock('@/infrastructure/google-api/SheetsExpenseRepo', () => ({
  SheetsExpenseRepo: function SheetsExpenseRepo() { return mockExpenses; },
}));
vi.mock('@/infrastructure/google-api/SheetsCategoryRepo', () => ({
  SheetsCategoryRepo: function SheetsCategoryRepo() { return mockCategories; },
}));
vi.mock('@/infrastructure/google-api/SheetsRuleRepo', () => ({
  SheetsRuleRepo: function SheetsRuleRepo() { return mockRules; },
}));
vi.mock('@/infrastructure/google-api/GeminiGateway', () => ({
  GeminiGateway: function GeminiGateway() { return {}; },
}));
vi.mock('../ConfigService', () => ({
  ConfigService: function ConfigService() { return mockConfig; },
}));
vi.mock('@/infrastructure/google-api/retry', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
}));
vi.mock('../../schemas/ticketSchema', () => ({
  ticketSchema: { parse: vi.fn((v: unknown) => v) },
}));

import { SyncEngine } from '../SyncEngine';
import { withRetry } from '@/infrastructure/google-api/retry';
import type { OmniSettings, Category, Rule } from '@/shared/types/domain';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TOKEN = 'test-token';

const defaultSettings: OmniSettings = {
  GMAIL_SEARCH_LABEL: 'OmniTicket',
  GMAIL_PROCESSED_LABEL: 'OmniTicket/Procesado',
  GEMINI_API_KEY: 'test-api-key',
  LAST_SYNC: 'Nunca',
};

const defaultCategories: Category[] = [
  { name: 'Bebidas', description: 'Agua, refrescos', status: 'active' },
  { name: 'Otros', description: 'Miscelánea', status: 'active' },
];

const defaultRules: Rule[] = [];

function makeTicket(overrides?: Record<string, unknown>) {
  return {
    id: 'uuid-1', tienda: 'Mercadona', fecha: '2025-01-15',
    items: [{ nombre: 'X', nombre_normalizado: 'X', categoria: 'Otros', precio_unitario: 1, cantidad: 1, descuento: 0, precio_total_linea: 1 }],
    total_ticket: 1,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  vi.spyOn(crypto, 'randomUUID').mockReturnValue(
    'test-uuid-1234' as `${string}-${string}-${string}-${string}-${string}`,
  );

  // Reset defaults
  mockGmail.searchThreads.mockResolvedValue([]);
  mockGmail.getThreadContent.mockResolvedValue('email content');
  mockGmail.addLabelToThread.mockResolvedValue(undefined);
  mockCategories.getCategories.mockResolvedValue(defaultCategories);
  mockRules.getRules.mockResolvedValue(defaultRules);
  mockExpenses.appendExpense.mockResolvedValue(undefined);
  mockConfig.getOrFindId.mockResolvedValue('spreadsheet-123');
  mockConfig.getSettings.mockResolvedValue(defaultSettings);
  mockConfig.updateLastSync.mockResolvedValue(undefined);
});

// ─── runSync ─────────────────────────────────────────────────────────────────

describe('SyncEngine.runSync', () => {
  it('returns empty results and updates last sync when no threads found', async () => {
    const engine = new SyncEngine(TOKEN);
    const results = await engine.runSync();

    expect(results).toEqual([]);
    expect(mockConfig.updateLastSync).toHaveBeenCalledTimes(1);
  });

  it('reports progress messages via callback', async () => {
    const messages: string[] = [];

    const engine = new SyncEngine(TOKEN);
    await engine.runSync(msg => messages.push(msg));

    expect(messages).toContain('Buscando nuevos tickets en Gmail...');
    expect(messages.some(m => m.includes('Todo al día'))).toBe(true);
  });

  it('builds correct Gmail search query from settings', async () => {
    const engine = new SyncEngine(TOKEN);
    await engine.runSync();

    expect(mockGmail.searchThreads).toHaveBeenCalledWith(
      'label:OmniTicket -label:OmniTicket/Procesado',
    );
  });

  it('processes a single thread successfully end-to-end', async () => {
    mockGmail.searchThreads.mockResolvedValue(['thread-1']);
    const ticketData = makeTicket({
      id: 'test-uuid-1234',
      tienda: 'Mercadona',
      items: [{
        nombre: 'COCA COLA ZERO 2L',
        nombre_normalizado: 'Coca Cola Zero',
        categoria: 'Bebidas',
        precio_unitario: 1.5,
        cantidad: 2,
        descuento: 0,
        precio_total_linea: 3.0,
      }],
      total_ticket: 3.0,
    });

    vi.mocked(withRetry).mockResolvedValue(ticketData);

    const engine = new SyncEngine(TOKEN);
    const results = await engine.runSync();

    expect(results).toEqual([{ messageId: 'thread-1', status: 'success' }]);
    expect(mockExpenses.appendExpense).toHaveBeenCalledWith('spreadsheet-123', ticketData);
    expect(mockGmail.addLabelToThread).toHaveBeenCalledWith('thread-1', 'OmniTicket/Procesado');
    expect(mockConfig.updateLastSync).toHaveBeenCalledTimes(1);
  });

  it('marks thread as error when processing fails', async () => {
    mockGmail.searchThreads.mockResolvedValue(['thread-1']);
    vi.mocked(withRetry).mockRejectedValue(new Error('Gemini parse error'));

    const engine = new SyncEngine(TOKEN);
    const results = await engine.runSync();

    expect(results).toEqual([{
      messageId: 'thread-1',
      status: 'error',
      error: 'Gemini parse error',
    }]);
    expect(mockGmail.addLabelToThread).not.toHaveBeenCalled();
    expect(mockConfig.updateLastSync).toHaveBeenCalledTimes(1);
  });

  it('processes multiple threads and counts successes/failures independently', async () => {
    mockGmail.searchThreads.mockResolvedValue(['thread-1', 'thread-2', 'thread-3']);

    vi.mocked(withRetry)
      .mockResolvedValueOnce(makeTicket({ id: 'uuid-1', tienda: 'Mercadona' }))
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce(makeTicket({ id: 'uuid-3', tienda: 'Lidl' }));

    const engine = new SyncEngine(TOKEN);
    const results = await engine.runSync();

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ messageId: 'thread-1', status: 'success' });
    expect(results[1]).toEqual({ messageId: 'thread-2', status: 'error', error: 'API error' });
    expect(results[2]).toEqual({ messageId: 'thread-3', status: 'success' });

    expect(mockGmail.addLabelToThread).toHaveBeenCalledTimes(2);
    expect(mockExpenses.appendExpense).toHaveBeenCalledTimes(2);
  });

  it('reports completion summary with all successes', async () => {
    mockGmail.searchThreads.mockResolvedValue(['thread-1']);
    vi.mocked(withRetry).mockResolvedValue(makeTicket());

    const messages: string[] = [];
    const engine = new SyncEngine(TOKEN);
    await engine.runSync(msg => messages.push(msg));

    const summary = messages[messages.length - 1]!;
    expect(summary).toContain('Sincronización completada');
    expect(summary).toContain('1 ticket procesado');
  });

  it('reports mixed summary when some tickets fail', async () => {
    mockGmail.searchThreads.mockResolvedValue(['thread-1', 'thread-2']);
    vi.mocked(withRetry)
      .mockResolvedValueOnce(makeTicket())
      .mockRejectedValueOnce(new Error('fail'));

    const messages: string[] = [];
    const engine = new SyncEngine(TOKEN);
    await engine.runSync(msg => messages.push(msg));

    const summary = messages[messages.length - 1]!;
    expect(summary).toContain('1 OK');
    expect(summary).toContain('1 con error');
  });

  it('uses plural form for multiple successful tickets', async () => {
    mockGmail.searchThreads.mockResolvedValue(['t1', 't2']);
    vi.mocked(withRetry).mockResolvedValue(makeTicket());

    const messages: string[] = [];
    const engine = new SyncEngine(TOKEN);
    await engine.runSync(msg => messages.push(msg));

    const summary = messages[messages.length - 1]!;
    expect(summary).toContain('2 tickets procesados');
  });

  it('loads categories and rules before processing threads', async () => {
    const engine = new SyncEngine(TOKEN);
    await engine.runSync();

    expect(mockCategories.getCategories).toHaveBeenCalledWith('spreadsheet-123');
    expect(mockRules.getRules).toHaveBeenCalledWith('spreadsheet-123');
  });

  it('does not label thread as processed when appendExpense fails', async () => {
    mockGmail.searchThreads.mockResolvedValue(['thread-1']);
    vi.mocked(withRetry).mockResolvedValue(makeTicket());
    mockExpenses.appendExpense.mockRejectedValue(new Error('Sheets API error'));

    const engine = new SyncEngine(TOKEN);
    const results = await engine.runSync();

    expect(results[0]!.status).toBe('error');
    expect(mockGmail.addLabelToThread).not.toHaveBeenCalled();
  });

  it('does not label thread as processed when addLabelToThread fails', async () => {
    mockGmail.searchThreads.mockResolvedValue(['thread-1']);
    vi.mocked(withRetry).mockResolvedValue(makeTicket());
    mockGmail.addLabelToThread.mockRejectedValue(new Error('Label error'));

    const engine = new SyncEngine(TOKEN);
    const results = await engine.runSync();

    expect(results[0]!.status).toBe('error');
    expect(results[0]!.error).toBe('Label error');
  });
});
