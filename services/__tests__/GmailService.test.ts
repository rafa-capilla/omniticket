import { describe, it, expect } from 'vitest';
import { extractTextFromPayload } from '../GmailService';

// Helper: encode a plain string as base64url (the format Gmail uses for body.data)
const b64url = (text: string) =>
  btoa(unescape(encodeURIComponent(text)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

// ─── extractTextFromPayload ───────────────────────────────────────────────────

describe('extractTextFromPayload', () => {
  it('decodes and returns text from a payload with direct body.data (base64url)', () => {
    const payload = { body: { data: b64url('Hello, World!') } };
    expect(extractTextFromPayload(payload)).toBe('Hello, World!');
  });

  it('returns an empty string for a completely empty payload', () => {
    expect(extractTextFromPayload({})).toBe('');
  });

  it('returns an empty string when parts array is present but empty', () => {
    expect(extractTextFromPayload({ parts: [] })).toBe('');
  });

  it('returns an empty string when body.data is malformed base64', () => {
    // atob will throw on truly invalid input; the function must return '' silently
    const payload = { body: { data: '!!!invalid!!!' } };
    expect(extractTextFromPayload(payload)).toBe('');
  });

  it('prefers text/plain over text/html when both are present as sibling parts', () => {
    const payload = {
      parts: [
        { mimeType: 'text/html', body: { data: b64url('<html>HTML content</html>') } },
        { mimeType: 'text/plain', body: { data: b64url('Plain text content') } },
      ],
    };
    expect(extractTextFromPayload(payload)).toBe('Plain text content');
  });

  it('falls back to text/html when no text/plain sibling is found', () => {
    const payload = {
      parts: [
        { mimeType: 'text/html', body: { data: b64url('<p>Only HTML</p>') } },
      ],
    };
    expect(extractTextFromPayload(payload)).toBe('<p>Only HTML</p>');
  });

  it('recursively extracts text/plain from a nested multipart/alternative structure', () => {
    const payload = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/plain', body: { data: b64url('Nested plain text') } },
            { mimeType: 'text/html', body: { data: b64url('<p>Nested HTML</p>') } },
          ],
        },
      ],
    };
    expect(extractTextFromPayload(payload)).toBe('Nested plain text');
  });

  it('descends into arbitrary sub-parts when no text/plain or text/html part is at the top level', () => {
    const payload = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          // A non-text part with no body.data and no sub-parts — returns ''
          mimeType: 'application/pdf',
        },
        {
          mimeType: 'multipart/alternative',
          parts: [
            { mimeType: 'text/plain', body: { data: b64url('Found it') } },
          ],
        },
      ],
    };
    // The first part yields nothing; the function recurses into the second part
    // and surfaces the nested text/plain content.
    expect(extractTextFromPayload(payload)).toBe('Found it');
  });

  it('correctly round-trips ASCII supermarket receipt content', () => {
    // atob returns raw Latin-1 bytes, so only ASCII round-trips losslessly.
    // Multi-byte characters (€, —) are left as-is by the production code.
    const content = 'Mercadona - Factura simplificada\nTotal: 25.40';
    const payload = { body: { data: b64url(content) } };
    expect(extractTextFromPayload(payload)).toBe(content);
  });
});
