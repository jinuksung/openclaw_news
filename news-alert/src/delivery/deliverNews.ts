import { pruneExpiredSentLinks, recordSentLinks, saveSentLinks } from '../store/sentStore';
import { sendTelegramMessages } from '../telegram/sendMessage';
import type { Logger } from '../utils/logger';

const SENT_TTL_DAYS = 7;

export type TelegramDeliveryConfig =
  | {
      enabled: false;
    }
  | {
      enabled: true;
      token: string;
      chatId: string;
      retryCount: number;
    };

export interface DeliverNewsInput {
  delivery: TelegramDeliveryConfig;
  messageChunks: string[];
  sentLinks: Map<string, string>;
  sentUrls: string[];
  sentStorePath: string;
  now: Date;
  logger: Pick<Logger, 'info' | 'warn' | 'error'>;
  sendMessages?: typeof sendTelegramMessages;
  saveLinks?: typeof saveSentLinks;
}

export function resolveTelegramDelivery(
  env: Record<string, string | undefined>,
  retryCount: number = 1
): TelegramDeliveryConfig {
  const enabled = parseBoolean(env.ENABLE_TELEGRAM, true);
  if (!enabled) {
    return {
      enabled: false
    };
  }

  return {
    enabled: true,
    token: requireEnv(env, 'TELEGRAM_BOT_TOKEN'),
    chatId: requireEnv(env, 'TELEGRAM_CHAT_ID'),
    retryCount
  };
}

export async function deliverNews(input: DeliverNewsInput): Promise<Map<string, string>> {
  if (!input.delivery.enabled) {
    input.logger.info('Telegram delivery disabled. Skip send and sent store update.', {
      chunks: input.messageChunks.length,
      selectedItems: input.sentUrls.length
    });
    return input.sentLinks;
  }

  const sendMessages = input.sendMessages ?? sendTelegramMessages;
  const saveLinks = input.saveLinks ?? saveSentLinks;

  await sendMessages({
    token: input.delivery.token,
    chatId: input.delivery.chatId,
    messages: input.messageChunks,
    retryCount: input.delivery.retryCount,
    logger: input.logger
  });

  const nextLinks = pruneExpiredSentLinks(
    recordSentLinks(input.sentLinks, input.sentUrls, input.now),
    input.now,
    SENT_TTL_DAYS
  );
  await saveLinks(input.sentStorePath, nextLinks);

  return nextLinks;
}

function requireEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function parseBoolean(rawValue: string | undefined, fallback: boolean): boolean {
  if (!rawValue) {
    return fallback;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}
