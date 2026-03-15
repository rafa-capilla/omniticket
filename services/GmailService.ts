/**
 * Facade that delegates to GmailGateway for backward compatibility.
 * @see infrastructure/google-api/GmailGateway.ts
 */

// Re-export extractTextFromPayload for tests and direct consumers
export { extractTextFromPayload } from '../infrastructure/google-api/GmailGateway';

import { GmailGateway } from '../infrastructure/google-api/GmailGateway';

export class GmailService {
  private readonly gateway: GmailGateway;

  constructor(accessToken: string) {
    this.gateway = new GmailGateway(accessToken);
  }

  async searchThreads(query: string): Promise<string[]> {
    return this.gateway.searchThreads(query);
  }

  async getThreadContent(threadId: string): Promise<string> {
    return this.gateway.getThreadContent(threadId);
  }

  async addLabelToThread(threadId: string, labelName: string): Promise<void> {
    return this.gateway.addLabelToThread(threadId, labelName);
  }
}
