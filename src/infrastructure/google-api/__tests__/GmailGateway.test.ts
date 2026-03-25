import { describe, it, expect, vi } from 'vitest';
import { extractTextFromPayload } from '../GmailGateway';
import type { GmailPayload } from '@/shared/types/google-api';

describe('extractTextFromPayload', () => {
  it('decodes Base64url body data', () => {
    const payload: GmailPayload = {
      mimeType: 'text/plain',
      body: { data: btoa('Hello World').replace(/\+/g, '-').replace(/\//g, '_') },
    };

    expect(extractTextFromPayload(payload)).toBe('Hello World');
  });

  it('returns empty string for empty payload', () => {
    expect(extractTextFromPayload({})).toBe('');
  });

  it('returns empty string when body has no data and no parts', () => {
    const payload: GmailPayload = {
      mimeType: 'text/plain',
      body: {},
    };

    expect(extractTextFromPayload(payload)).toBe('');
  });

  it('prefers text/plain over text/html in multipart', () => {
    const payload: GmailPayload = {
      mimeType: 'multipart/alternative',
      body: {},
      parts: [
        { mimeType: 'text/html', body: { data: btoa('<b>HTML</b>') } },
        { mimeType: 'text/plain', body: { data: btoa('Plain text') } },
      ],
    };

    expect(extractTextFromPayload(payload)).toBe('Plain text');
  });

  it('falls back to text/html when no text/plain exists', () => {
    const payload: GmailPayload = {
      mimeType: 'multipart/alternative',
      body: {},
      parts: [
        { mimeType: 'text/html', body: { data: btoa('<b>HTML</b>') } },
      ],
    };

    expect(extractTextFromPayload(payload)).toBe('<b>HTML</b>');
  });

  it('recurses into nested multipart structures', () => {
    const payload: GmailPayload = {
      mimeType: 'multipart/mixed',
      body: {},
      parts: [
        {
          mimeType: 'multipart/alternative',
          body: {},
          parts: [
            { mimeType: 'text/plain', body: { data: btoa('Nested plain') } },
          ],
        },
      ],
    };

    expect(extractTextFromPayload(payload)).toBe('Nested plain');
  });

  it('tries remaining parts when first ones have no text', () => {
    const payload: GmailPayload = {
      mimeType: 'multipart/mixed',
      body: {},
      parts: [
        { mimeType: 'image/png', body: {} },
        { mimeType: 'application/pdf', body: {} },
        {
          mimeType: 'multipart/alternative',
          body: {},
          parts: [
            { mimeType: 'text/plain', body: { data: btoa('Found it') } },
          ],
        },
      ],
    };

    expect(extractTextFromPayload(payload)).toBe('Found it');
  });

  it('returns empty string on invalid Base64 data (logs warning)', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const payload: GmailPayload = {
      mimeType: 'text/plain',
      body: { data: '!!!invalid-base64!!!' },
    };

    expect(extractTextFromPayload(payload)).toBe('');
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0]![0]).toContain('Failed to decode Base64');

    warnSpy.mockRestore();
  });

  it('handles payload with empty parts array', () => {
    const payload: GmailPayload = {
      mimeType: 'multipart/mixed',
      body: {},
      parts: [],
    };

    expect(extractTextFromPayload(payload)).toBe('');
  });

  it('decodes content with special Base64url characters (- and _)', () => {
    // Create content that produces + and / in standard Base64
    const content = 'Precio: 3.99\x00\xff';
    const base64 = btoa(content);
    const base64url = base64.replace(/\+/g, '-').replace(/\//g, '_');

    const payload: GmailPayload = {
      mimeType: 'text/plain',
      body: { data: base64url },
    };

    expect(extractTextFromPayload(payload)).toBe(content);
  });

  it('handles deeply nested multipart (3+ levels)', () => {
    const payload: GmailPayload = {
      mimeType: 'multipart/mixed',
      body: {},
      parts: [{
        mimeType: 'multipart/related',
        body: {},
        parts: [{
          mimeType: 'multipart/alternative',
          body: {},
          parts: [
            { mimeType: 'text/plain', body: { data: btoa('Deep text') } },
          ],
        }],
      }],
    };

    expect(extractTextFromPayload(payload)).toBe('Deep text');
  });
});
