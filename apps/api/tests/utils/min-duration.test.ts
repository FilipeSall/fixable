import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { withMinimumDuration } from '../../src/utils/min-duration.ts';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('withMinimumDuration', () => {
  it('tarefa rápida só resolve depois do tempo mínimo', async () => {
    let resolved = false;
    const promise = withMinimumDuration(250, Promise.resolve('ok')).then((value) => {
      resolved = true;
      return value;
    });

    await vi.advanceTimersByTimeAsync(249);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(promise).resolves.toBe('ok');
  });

  it('tarefa mais lenta que o mínimo resolve quando ela termina', async () => {
    const slow = new Promise<string>((resolve) => setTimeout(() => resolve('lento'), 400));
    const promise = withMinimumDuration(250, slow);

    await vi.advanceTimersByTimeAsync(400);
    await expect(promise).resolves.toBe('lento');
  });
});
