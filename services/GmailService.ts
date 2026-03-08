
import { apiFetch } from './apiFetch';

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

/**
 * Extrae texto de un payload de Gmail de forma recursiva.
 * Prioriza text/plain > text/html > recursión en sub-partes multipart.
 */
function extractTextFromPayload(payload: GmailPayload): string {
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

  async searchThreads(query: string): Promise<string[]> {
    const response = await apiFetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads?q=${encodeURIComponent(query)}`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    const data = await response.json();
    return (data.threads || []).map((t: GmailThread) => t.id);
  }

  async getThreadContent(threadId: string): Promise<string> {
    const response = await apiFetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}`,
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    const data = await response.json();

    // Concatenar el texto de todos los mensajes del thread
    let fullText = '';
    for (const msg of (data.messages || [])) {
      const text = extractTextFromPayload(msg.payload || {});
      if (text) fullText += text + '\n';
    }

    return fullText;
  }

  async addLabelToThread(threadId: string, labelName: string) {
    const labelId = await this.getOrCreateLabel(labelName);
    await apiFetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ addLabelIds: [labelId] })
      }
    );
  }

  private async getOrCreateLabel(name: string): Promise<string> {
    if (this.labelCache.has(name)) return this.labelCache.get(name)!;

    const response = await apiFetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      { headers: { Authorization: `Bearer ${this.accessToken}` } }
    );
    const data = await response.json();
    const existing = (data.labels as GmailLabel[]).find(l => l.name === name);
    if (existing) {
      this.labelCache.set(name, existing.id);
      return existing.id;
    }

    const createResponse = await apiFetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/labels',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
      }
    );
    const created = await createResponse.json();
    this.labelCache.set(name, created.id);
    return created.id;
  }
}
