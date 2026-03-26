import { describe, it, expect, vi, afterEach } from 'vitest';
import { withRetry } from '../retry';
import { RateLimitError } from '@/domain/errors';

afterEach(() => {
  vi.useRealTimers();
});

describe('withRetry', () => {
  it('returns the result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    expect(await withRetry(fn)).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on RateLimitError and succeeds', async () => {
    vi.useFakeTimers();
    const fn = vi.fn()
      .mockRejectedValueOnce(new RateLimitError())
      .mockResolvedValue('ok');

    const promise = withRetry(fn);
    await vi.runAllTimersAsync();

    expect(await promise).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on non-rate-limit errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Network error'));
    await expect(withRetry(fn)).rejects.toThrow('Network error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws after exhausting all attempts', async () => {
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

  it('applies exponential backoff delays (1s, 2s)', async () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    const fn = vi.fn()
      .mockRejectedValueOnce(new RateLimitError())
      .mockRejectedValueOnce(new RateLimitError())
      .mockResolvedValue('ok');

    const promise = withRetry(fn, 3);
    await vi.runAllTimersAsync();
    await promise;

    const delays = setTimeoutSpy.mock.calls
      .map(([, ms]) => ms as number)
      .filter(ms => ms > 0);

    expect(delays).toEqual([1000, 2000]);
  });

  it('propagates non-Error thrown values without retrying', async () => {
    const fn = vi.fn().mockRejectedValue('string error');
    await expect(withRetry(fn)).rejects.toBe('string error');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
