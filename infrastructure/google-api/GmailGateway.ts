import { apiFetch } from '../../services/apiFetch';
import { GMAIL_API } from '../../lib/constants';
import { authHeaders, jsonAuthHeaders } from '../../lib/utils';
import type {
  GmailPayload,
  GmailThreadsResponse,
  GmailThreadResponse,
  GmailLabelsResponse,
  GmailLabelResponse,
} from '../../shared/types/google-api';
import type { EmailGateway } from '../../application/ports/EmailGateway';

/**
 * Extrae texto de un payload de Gmail de forma recursiva.
 * Prioriza text/plain > text/html > recursión en sub-partes multipart.
 *
 * Exported for unit testing.
 */
export function extractTextFromPayload(payload: GmailPayload): string {
  if (payload.body?.data) {
    try {
      return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    } catch {
      return '';
    }
  }

  const parts = payload.parts ?? [];
  if (parts.length === 0) return '';

  const plain = parts.find(p => p.mimeType === 'text/plain');
  if (plain) return extractTextFromPayload(plain);

  const html = parts.find(p => p.mimeType === 'text/html');
  if (html) return extractTextFromPayload(html);

  for (const part of parts) {
    const text = extractTextFromPayload(part);
    if (text) return text;
  }

  return '';
}

/**
 * Implements EmailGateway using Gmail API.
 */
export class GmailGateway implements EmailGateway {
  private readonly labelCache = new Map<string, string>();

  constructor(private accessToken: string) {}

  private get auth()     { return authHeaders(this.accessToken); }
  private get jsonAuth() { return jsonAuthHeaders(this.accessToken); }

  async searchThreads(query: string): Promise<string[]> {
    const response = await apiFetch(
      `${GMAIL_API}/threads?q=${encodeURIComponent(query)}`,
      { headers: this.auth }
    );
    const data: GmailThreadsResponse = await response.json();
    return (data.threads ?? []).map(t => t.id);
  }

  async getThreadContent(threadId: string): Promise<string> {
    const response = await apiFetch(
      `${GMAIL_API}/threads/${threadId}`,
      { headers: this.auth }
    );
    const data: GmailThreadResponse = await response.json();

    let fullText = '';
    for (const msg of (data.messages ?? [])) {
      const text = extractTextFromPayload(msg.payload ?? {});
      if (text) fullText += text + '\n';
    }

    return fullText;
  }

  async addLabelToThread(threadId: string, labelName: string): Promise<void> {
    const labelId = await this.getOrCreateLabel(labelName);
    await apiFetch(
      `${GMAIL_API}/threads/${threadId}/modify`,
      { method: 'POST', headers: this.jsonAuth, body: JSON.stringify({ addLabelIds: [labelId] }) }
    );
  }

  private async getOrCreateLabel(name: string): Promise<string> {
    const cached = this.labelCache.get(name);
    if (cached !== undefined) return cached;

    const response = await apiFetch(`${GMAIL_API}/labels`, { headers: this.auth });
    const data: GmailLabelsResponse = await response.json();
    const existing = (data.labels ?? []).find(l => l.name === name);
    if (existing) {
      this.labelCache.set(name, existing.id);
      return existing.id;
    }

    const createResponse = await apiFetch(`${GMAIL_API}/labels`, {
      method: 'POST',
      headers: this.jsonAuth,
      body: JSON.stringify({ name, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
    });
    const created: GmailLabelResponse = await createResponse.json();
    this.labelCache.set(name, created.id);
    return created.id;
  }
}
