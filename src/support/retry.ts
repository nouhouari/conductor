export interface RetryOptions {
  attempts?: number;
  delayMs?: number;
  backoff?: 'fixed' | 'exponential';
}

export async function retry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { attempts = 3, delayMs = 1000, backoff = 'fixed' } = opts;
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        const wait = backoff === 'exponential' ? delayMs * 2 ** i : delayMs;
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }

  throw lastError;
}
