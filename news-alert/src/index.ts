import { config as loadDotEnv } from 'dotenv';
import { resolve } from 'node:path';

import { archiveArticles } from './archive/archiveArticles';
import { composeMessages } from './compose/composeMessage';
import { loadFeeds } from './config/loadFeeds';
import { deliverNews, resolveTelegramDelivery } from './delivery/deliverNews';
import { fetchFeeds } from './rss/fetchFeeds';
import type { NormalizedNewsItem } from './rss/normalizeItem';
import { OpenAISummarizer } from './summarize/openaiSummarizer';
import type { SummaryResult } from './summarize/Summarizer';
import { loadSentLinks } from './store/sentStore';
import { createLogger, toErrorMessage } from './utils/logger';
import { formatKstDate } from './utils/time';

loadDotEnv();

const logger = createLogger(resolve(process.cwd(), 'logs/news-alert.log'));

const DEFAULT_SECTION_TOP_N = 5;
const DEFAULT_TOTAL_TOP_N = 20;
const DEFAULT_FEED_TIMEOUT_MS = 10_000;
const DEFAULT_FEED_RETRY_COUNT = 1;
const DEFAULT_ARTICLE_FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_ARTICLE_FETCH_RETRY_COUNT = 1;
const DEFAULT_TELEGRAM_RETRY_COUNT = 1;
const DEFAULT_SUMMARY_TOTAL_TOP_K = 8;
const DEFAULT_SUMMARY_PER_SECTION_TOP_K = 3;

async function runOnce(): Promise<void> {
  const dateKst = formatKstDate(new Date());
  logger.info('Run-once started.', { dateKst });

  const sectionTopN = parsePositiveInt(process.env.SECTION_TOP_N, DEFAULT_SECTION_TOP_N);
  const totalTopN = parsePositiveInt(process.env.TOTAL_TOP_N, DEFAULT_TOTAL_TOP_N);
  const feedTimeoutMs = parsePositiveInt(process.env.FEED_TIMEOUT_MS, DEFAULT_FEED_TIMEOUT_MS);
  const feedRetryCount = parseNonNegativeInt(process.env.FEED_RETRY_COUNT, DEFAULT_FEED_RETRY_COUNT);
  const articleFetchTimeoutMs = parsePositiveInt(
    process.env.ARTICLE_FETCH_TIMEOUT_MS,
    DEFAULT_ARTICLE_FETCH_TIMEOUT_MS
  );
  const articleFetchRetryCount = parseNonNegativeInt(
    process.env.ARTICLE_FETCH_RETRY_COUNT,
    DEFAULT_ARTICLE_FETCH_RETRY_COUNT
  );
  const telegramRetryCount = parseNonNegativeInt(
    process.env.TELEGRAM_RETRY_COUNT,
    DEFAULT_TELEGRAM_RETRY_COUNT
  );
  const telegramDelivery = resolveTelegramDelivery(process.env, telegramRetryCount);

  const sentStorePath = resolve(process.cwd(), 'data/sent.json');
  const now = new Date();
  let sentLinks = await loadSentLinks(sentStorePath, now, 7);

  const sectionFeeds = await loadFeeds();
  const feedResult = await fetchFeeds({
    sectionFeeds,
    sectionTopN,
    totalTopN,
    timeoutMs: feedTimeoutMs,
    retryCount: feedRetryCount,
    userAgent: 'news-alert/1.0 (+run-once)',
    logger,
    excludedUrls: new Set(sentLinks.keys())
  });

  if (feedResult.fetchedItemCount === 0) {
    logger.info('No new items to send.');
    return;
  }

  const selectedItems = flattenSelectedItems(feedResult.sectionItems, feedResult.sectionOrder);
  await archiveArticles({
    baseDir: process.cwd(),
    dateKst,
    items: selectedItems,
    now,
    timeoutMs: articleFetchTimeoutMs,
    retryCount: articleFetchRetryCount,
    logger
  });

  const sentUrls = collectUrls(feedResult.sectionItems, feedResult.sectionOrder);
  let messageChunks: string[] = [];

  if (telegramDelivery.enabled) {
    const summary = await maybeSummarize({
      dateKst,
      sectionOrder: feedResult.sectionOrder,
      sectionItems: feedResult.sectionItems
    });

    messageChunks = composeMessages({
      dateKst,
      sectionOrder: feedResult.sectionOrder,
      sectionItems: feedResult.sectionItems,
      summary
    });
  }

  sentLinks = await deliverNews({
    delivery: telegramDelivery,
    messageChunks,
    sentLinks,
    sentUrls,
    sentStorePath,
    now,
    logger
  });

  logger.info('Run-once completed.', {
    sections: feedResult.sectionOrder.length,
    selectedItems: sentUrls.length,
    sentItems: telegramDelivery.enabled ? sentUrls.length : 0,
    chunks: messageChunks.length,
    telegramEnabled: telegramDelivery.enabled,
    failedFeeds: feedResult.failedFeedCount
  });
}

function flattenSelectedItems(
  sectionItems: Record<string, NormalizedNewsItem[]>,
  sectionOrder: string[]
): NormalizedNewsItem[] {
  return sectionOrder.flatMap((section) => sectionItems[section] ?? []);
}

async function maybeSummarize(input: {
  dateKst: string;
  sectionOrder: string[];
  sectionItems: Record<string, NormalizedNewsItem[]>;
}): Promise<SummaryResult | undefined> {
  const enabled = parseBoolean(process.env.ENABLE_AI_SUMMARY, false);
  if (!enabled) {
    return undefined;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    logger.warn('ENABLE_AI_SUMMARY=true but OPENAI_API_KEY is missing. Skip summary.');
    return undefined;
  }

  const summaryTotalTopK = parsePositiveInt(process.env.SUMMARY_TOTAL_TOP_K, DEFAULT_SUMMARY_TOTAL_TOP_K);
  const summaryPerSectionTopK = parsePositiveInt(
    process.env.SUMMARY_PER_SECTION_TOP_K,
    DEFAULT_SUMMARY_PER_SECTION_TOP_K
  );

  const summarizer = new OpenAISummarizer({
    apiKey,
    logger
  });

  return summarizer.summarize({
    dateKst: input.dateKst,
    sectionOrder: input.sectionOrder,
    sectionItems: input.sectionItems,
    totalTopK: summaryTotalTopK,
    perSectionTopK: summaryPerSectionTopK
  });
}

function collectUrls(
  sectionItems: Record<string, NormalizedNewsItem[]>,
  sectionOrder: string[]
): string[] {
  const urls: string[] = [];

  for (const section of sectionOrder) {
    for (const item of sectionItems[section] ?? []) {
      urls.push(item.url);
    }
  }

  return urls;
}

function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  const parsed = Number(rawValue);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  return fallback;
}

function parseNonNegativeInt(rawValue: string | undefined, fallback: number): number {
  const parsed = Number(rawValue);
  if (Number.isInteger(parsed) && parsed >= 0) {
    return parsed;
  }

  return fallback;
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

void runOnce().catch((error) => {
  logger.error('Run-once failed.', {
    reason: toErrorMessage(error)
  });
  process.exitCode = 1;
});
