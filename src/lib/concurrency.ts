export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Run an async mapper over items with a bounded number of concurrent workers.
 * Results preserve input order; failures are captured per item instead of
 * rejecting the whole batch.
 */
export async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Retry an async operation with exponential backoff and jitter. Used to ride
 * out transient provider failures (429s, 5xx, network blips).
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 2, baseMs = 500): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) {
        await sleep(baseMs * 2 ** attempt + Math.random() * 250);
      }
    }
  }
  throw lastError;
}

/** Simple token bucket used to stay under provider rate limits. */
export class RateLimiter {
  private tokens: number;
  private last = Date.now();

  constructor(
    private ratePerMinute: number,
    private burst = Math.max(1, Math.floor(ratePerMinute / 4)),
  ) {
    this.tokens = burst;
  }

  async acquire(): Promise<void> {
    for (;;) {
      const now = Date.now();
      const refill = ((now - this.last) / 60000) * this.ratePerMinute;
      if (refill > 0) {
        this.tokens = Math.min(this.burst, this.tokens + refill);
        this.last = now;
      }
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = Math.ceil(((1 - this.tokens) / this.ratePerMinute) * 60000);
      await sleep(Math.min(waitMs, 1000));
    }
  }
}
