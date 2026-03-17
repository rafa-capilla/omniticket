/**
 * Port for email access operations.
 * Abstracts how email threads are searched and modified.
 */
export interface EmailGateway {
  searchThreads(query: string): Promise<string[]>;
  getThreadContent(threadId: string): Promise<string>;
  addLabelToThread(threadId: string, labelName: string): Promise<void>;
}
