export interface RetryOptions {
  retries: number;
  delayMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number) => void | Promise<void>;
}

export async function sleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function retry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const retries = Math.max(0, options.retries);
  const delayMs = Math.max(0, options.delayMs ?? 0);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      const canRetry = attempt < retries && (options.shouldRetry?.(error, attempt) ?? true);

      if (!canRetry) {
        throw error;
      }

      await options.onRetry?.(error, attempt + 1);
      if (delayMs > 0) {
        await sleep(delayMs);
      }
    }
  }

  throw new Error('retry exhausted unexpectedly');
}
