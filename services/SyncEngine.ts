import { GmailGateway } from "../infrastructure/google-api/GmailGateway";
import { SheetsExpenseRepo } from "../infrastructure/google-api/SheetsExpenseRepo";
import { SheetsCategoryRepo } from "../infrastructure/google-api/SheetsCategoryRepo";
import { SheetsRuleRepo } from "../infrastructure/google-api/SheetsRuleRepo";
import { GeminiGateway } from "../infrastructure/google-api/GeminiGateway";
import { ConfigService } from "./ConfigService";
import { SyncTickets } from "../application/use-cases/SyncTickets";
import { SyncResult } from "../types";

/**
 * Motor de sincronización principal de OmniTicket.
 * Facade that delegates to the SyncTickets use case.
 * Maintains the original public API for backward compatibility.
 */
export class SyncEngine {
  private readonly useCase: SyncTickets;

  constructor(accessToken: string) {
    this.useCase = new SyncTickets({
      email: new GmailGateway(accessToken),
      ai: new GeminiGateway(),
      expenses: new SheetsExpenseRepo(accessToken),
      categories: new SheetsCategoryRepo(accessToken),
      rules: new SheetsRuleRepo(accessToken),
      config: new ConfigService(accessToken),
    });
  }

  async runSync(onProgress?: (msg: string) => void): Promise<SyncResult[]> {
    return this.useCase.execute(onProgress);
  }
}
