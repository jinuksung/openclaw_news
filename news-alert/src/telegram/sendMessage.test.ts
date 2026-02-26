import { describe, expect, it, vi } from 'vitest';

import { sendTelegramMessages } from './sendMessage';

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
};

describe('sendTelegramMessages', () => {
  it('retries once when network fails', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await sendTelegramMessages({
      token: 'token',
      chatId: 'chat-id',
      messages: ['hello'],
      fetchFn,
      sleep: async () => {
        await Promise.resolve();
      },
      logger,
      retryCount: 1
    });

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('waits Retry-After and retries once on 429', async () => {
    const sleep = vi.fn(async () => {
      await Promise.resolve();
    });
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false }), {
          status: 429,
          headers: {
            'Retry-After': '1'
          }
        })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    await sendTelegramMessages({
      token: 'token',
      chatId: 'chat-id',
      messages: ['hello'],
      fetchFn,
      sleep,
      logger,
      retryCount: 1
    });

    expect(sleep).toHaveBeenCalledWith(1000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('does not retry more than once for repeated 429 responses', async () => {
    const sleep = vi.fn(async () => {
      await Promise.resolve();
    });
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false }), {
          status: 429,
          headers: {
            'Retry-After': '1'
          }
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: false }), {
          status: 429,
          headers: {
            'Retry-After': '1'
          }
        })
      );

    await expect(
      sendTelegramMessages({
        token: 'token',
        chatId: 'chat-id',
        messages: ['hello'],
        fetchFn,
        sleep,
        logger,
        retryCount: 1
      })
    ).rejects.toThrow();

    expect(fetchFn).toHaveBeenCalledTimes(2);
  });
});
