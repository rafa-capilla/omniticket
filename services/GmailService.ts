
import { apiFetch } from './apiFetch';
import { GMAIL_API } from '../lib/constants';
import { authHeaders, jsonAuthHeaders } from '../lib/utils';

interface GmailThread {
  id: string;
}

interface GmailLabel {
  id: string;
  name: string;
}

interface GmailPayload {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPayload[];
}

interface GmailMessage {
  payload?: GmailPayload;
}

/** Gmail threads.list */
interface GmailThreadsResponse {
  threads?: GmailThread[];
}

/** Gmail threads.get */
interface GmailThreadResponse {
  messages?: GmailMessage[];
}

/** Gmail labels.list */
interface GmailLabelsResponse {
  labels?: GmailLabel[];
}

/** Gmail labels.create */
interface GmailLabelResponse {
  id: string;
}

/**
 * Extrae texto de un payload de Gmail de forma recursiva.
 * Prioriza text/plain > text/html > recursión en sub-partes multipart.
 *
 * Exported for unit testing.
 */
export function extractTextFromPayload(payload: GmailPayload): string {
  // Caso base: el payload tiene body con datos directamente
  if (payload.body?.data) {
    try {
      return atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
    } catch {
      return '';
    }
  }

  const parts = payload.parts ?? [];
  if (parts.length === 0) return '';

  // Prioridad 1: text/plain (ideal para Gemini, sin ruido de HTML)
  const plain = parts.find(p => p.mimeType === 'text/plain');
  if (plain) return extractTextFromPayload(plain);

  // Prioridad 2: text/html
  const html = parts.find(p => p.mimeType === 'text/html');
  if (html) return extractTextFromPayload(html);

  // Prioridad 3: descender recursivamente en sub-partes (multipart/alternative, multipart/mixed, etc.)
  for (const part of parts) {
    const text = extractTextFromPayload(part);
    if (text) return text;
  }

  return '';
}

export class GmailService {
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

    // Concatenar el texto de todos los mensajes del thread
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
