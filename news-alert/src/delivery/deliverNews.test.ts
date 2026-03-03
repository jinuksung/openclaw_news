import { describe, expect, it, vi } from 'vitest';

import { deliverNews, resolveTelegramDelivery } from './deliverNews';

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

describe('resolveTelegramDelivery', () => {
  it('disables telegram without requiring bot credentials when ENABLE_TELEGRAM=false', () => {
    const delivery = resolveTelegramDelivery({
      ENABLE_TELEGRAM: 'false'
    });

    expect(delivery.enabled).toBe(false);
  });

  it('disables telegram without requiring bot credentials when SKIP_TELEGRAM=true', () => {
    const delivery = resolveTelegramDelivery({
      SKIP_TELEGRAM: 'true'
    });

    expect(delivery.enabled).toBe(false);
  });

  it('requires bot credentials when telegram delivery stays enabled', () => {
    expect(() => resolveTelegramDelivery({})).toThrow('Missing required environment variable: TELEGRAM_BOT_TOKEN');
  });
});

describe('deliverNews', () => {
  it('skips telegram send and sent-store update when delivery is disabled', async () => {
    const sendMessages = vi.fn();
    const saveLinks = vi.fn();
    const sentLinks = new Map<string, string>([['https://existing.com', '2026-03-01T00:00:00.000Z']]);

    const nextLinks = await deliverNews({
      delivery: {
        enabled: false
      },
      messageChunks: ['hello'],
      sentLinks,
      sentUrls: ['https://new.com'],
      sentStorePath: '/tmp/sent.json',
      now: new Date('2026-03-02T00:00:00.000Z'),
      logger,
      sendMessages,
      saveLinks
    });

    expect(sendMessages).not.toHaveBeenCalled();
    expect(saveLinks).not.toHaveBeenCalled();
    expect(nextLinks).toBe(sentLinks);
  });

  it('sends telegram messages and persists sent links when delivery is enabled', async () => {
    const sendMessages = vi.fn(async () => {
      await Promise.resolve();
    });
    const saveLinks = vi.fn(async () => {
      await Promise.resolve();
    });
    const sentLinks = new Map<string, string>();
    const now = new Date('2026-03-02T00:00:00.000Z');

    const nextLinks = await deliverNews({
      delivery: {
        enabled: true,
        token: 'token',
        chatId: 'chat-id',
        retryCount: 2
      },
      messageChunks: ['hello'],
      sentLinks,
      sentUrls: ['https://new.com'],
      sentStorePath: '/tmp/sent.json',
      now,
      logger,
      sendMessages,
      saveLinks
    });

    expect(sendMessages).toHaveBeenCalledWith({
      token: 'token',
      chatId: 'chat-id',
      messages: ['hello'],
      retryCount: 2,
      logger
    });
    expect(saveLinks).toHaveBeenCalledTimes(1);
    expect(nextLinks.get('https://new.com')).toBe(now.toISOString());
  });
});
