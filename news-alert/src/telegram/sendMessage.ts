import type { Logger } from '../utils/logger';
import { toErrorMessage } from '../utils/logger';
import { sleep as defaultSleep } from '../utils/retry';

interface TelegramApiResponse {
  ok: boolean;
  description?: string;
  parameters?: {
    retry_after?: number;
  };
}

export interface SendTelegramMessagesInput {
  token: string;
  chatId: string;
  messages: string[];
  retryCount: number;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  logger: Pick<Logger, 'info' | 'warn' | 'error'>;
}

export async function sendTelegramMessages(input: SendTelegramMessagesInput): Promise<void> {
  const fetchFn = input.fetchFn ?? fetch;
  const sleep = input.sleep ?? defaultSleep;

  for (const message of input.messages) {
    await sendSingleMessage({
      token: input.token,
      chatId: input.chatId,
      message,
      retryCount: input.retryCount,
      fetchFn,
      sleep,
      logger: input.logger
    });
  }
}

interface SendSingleMessageInput {
  token: string;
  chatId: string;
  message: string;
  retryCount: number;
  fetchFn: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  logger: Pick<Logger, 'info' | 'warn' | 'error'>;
}

class RateLimitRetryExceededError extends Error {}

async function sendSingleMessage(input: SendSingleMessageInput): Promise<void> {
  const endpoint = `https://api.telegram.org/bot${input.token}/sendMessage`;
  let networkRetryAttempt = 0;
  let rateLimitRetried = false;
  let done = false;

  while (!done) {
    try {
      const response = await input.fetchFn(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: input.chatId,
          text: input.message,
          parse_mode: 'HTML',
          disable_web_page_preview: false
        })
      });

      const responseBody = await safeParseJson(response);

      if (response.status === 429) {
        if (rateLimitRetried) {
          throw new RateLimitRetryExceededError('Telegram 429 persisted after retry.');
        }

        rateLimitRetried = true;
        const retryAfterMs = resolveRetryAfterMs(response, responseBody);
        input.logger.warn('Telegram rate limit(429). Retrying once after delay.', {
          retryAfterMs
        });
        await input.sleep(retryAfterMs);
        continue;
      }

      if (!response.ok) {
        const description = responseBody?.description ?? `HTTP ${response.status}`;
        throw new Error(`Telegram API error: ${description}`);
      }

      if (responseBody && !responseBody.ok) {
        const retryAfter = responseBody.parameters?.retry_after;
        if (!rateLimitRetried && typeof retryAfter === 'number' && retryAfter > 0) {
          rateLimitRetried = true;
          const retryAfterMs = retryAfter * 1000;
          input.logger.warn('Telegram API asked retry_after. Retrying once after delay.', {
            retryAfterMs
          });
          await input.sleep(retryAfterMs);
          continue;
        }

        throw new RateLimitRetryExceededError(
          `Telegram API rejected message: ${responseBody.description ?? 'unknown error'}`
        );
      }

      input.logger.info('Telegram message sent.', {
        chars: input.message.length
      });
      done = true;
      return;
    } catch (error) {
      if (error instanceof RateLimitRetryExceededError) {
        throw error;
      }

      if (networkRetryAttempt < Math.max(0, input.retryCount)) {
        networkRetryAttempt += 1;
        input.logger.warn('Telegram send failed. Retry network once.', {
          attempt: networkRetryAttempt,
          reason: toErrorMessage(error)
        });
        continue;
      }

      throw error;
    }
  }
}

async function safeParseJson(response: Response): Promise<TelegramApiResponse | null> {
  const text = await response.text();
  if (!text.trim()) {
    return null;
  }

  try {
    return JSON.parse(text) as TelegramApiResponse;
  } catch {
    return null;
  }
}

function resolveRetryAfterMs(response: Response, payload: TelegramApiResponse | null): number {
  const header = response.headers.get('retry-after');
  if (header) {
    const seconds = Number(header);
    if (!Number.isNaN(seconds) && seconds > 0) {
      return seconds * 1000;
    }
  }

  const bodySeconds = payload?.parameters?.retry_after;
  if (typeof bodySeconds === 'number' && bodySeconds > 0) {
    return bodySeconds * 1000;
  }

  return 1000;
}
