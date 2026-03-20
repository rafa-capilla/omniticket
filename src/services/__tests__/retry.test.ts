import { describe, it, expect, vi, afterEach } from 'vitest';
import { withRetry } from '../retry';
import { RateLimitError } from '@/domain/errors';

afterEach(() => {
  vi.useRealTimers();
});

// ─── withRetry ────────────────────────────────────────────────────────────────

describe('withRetry', () => {
  it('returns the result when the function succeeds on the first attempt', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries when the error is a RateLimitError', async () => {
    vi.useFakeTimers();
    const fn = vi.fn()
      .mockRejectedValueOnce(new RateLimitError())
      .mockResolvedValue('ok');

    const promise = withRetry(fn);
    await vi.runAllTimersAsync();

    expect(await promise).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on a non-rate-limit error — propagates immediately', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Network error'));
    await expect(withRetry(fn)).rejects.toThrow('Network error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on a generic 500 error', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Error HTTP 500'));
    await expect(withRetry(fn)).rejects.toThrow('Error HTTP 500');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting all attempts when every call hits a rate-limit', async () => {
    vi.useFakeTimers();
    const fn = vi.fn()
      .mockRejectedValueOnce(new RateLimitError())
      .mockRejectedValueOnce(new RateLimitError())
      .mockRejectedValueOnce(new RateLimitError());

    const promise = withRetry(fn, 3);
    const assertion = expect(promise).rejects.toThrow(RateLimitError);
    await vi.runAllTimersAsync();
    await assertion;

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('succeeds on the last allowable attempt', async () => {
    vi.useFakeTimers();
    const fn = vi.fn()
      .mockRejectedValueOnce(new RateLimitError())
      .mockRejectedValueOnce(new RateLimitError())
      .mockResolvedValue('last chance');

    const promise = withRetry(fn, 3);
    await vi.runAllTimersAsync();

    expect(await promise).toBe('last chance');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('applies exponential backoff: delays are 1 s then 2 s for two retries', async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const fn = vi.fn()
      .mockRejectedValueOnce(new RateLimitError())
      .mockRejectedValueOnce(new RateLimitError())
      .mockResolvedValue('ok');

    const promise = withRetry(fn, 3);
    await vi.runAllTimersAsync();
    await promise;

    // Collect only the meaningful delay calls (> 0 ms)
    const delays = setTimeoutSpy.mock.calls
      .map(([, ms]) => ms as number)
      .filter(ms => ms > 0);

    expect(delays).toEqual([1000, 2000]);
  });

  it('propagates non-Error thrown values (e.g. thrown strings) without retrying', async () => {
    const fn = vi.fn().mockRejectedValue('something went wrong');
    await expect(withRetry(fn)).rejects.toBe('something went wrong');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
