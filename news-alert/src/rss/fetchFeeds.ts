import Parser from 'rss-parser';

import type { Logger } from '../utils/logger';
import { toErrorMessage } from '../utils/logger';
import { retry } from '../utils/retry';
import { getDomainFromUrl, normalizeItem, type NormalizedNewsItem } from './normalizeItem';

export interface SectionFeedConfig {
  section: string;
  urls: string[];
}

export interface FetchFeedsOptions {
  sectionFeeds: SectionFeedConfig[];
  sectionTopN: number;
  totalTopN: number;
  timeoutMs: number;
  retryCount: number;
  userAgent: string;
  logger: Pick<Logger, 'info' | 'warn'>;
  excludedUrls?: Set<string>;
  fetchFn?: typeof fetch;
}

export interface FetchFeedsResult {
  sectionOrder: string[];
  sectionItems: Record<string, NormalizedNewsItem[]>;
  fetchedItemCount: number;
  failedFeedCount: number;
}

export interface ApplySectionAndGlobalLimitsOptions {
  itemsBySection: Record<string, NormalizedNewsItem[]>;
  sectionOrder: string[];
  sectionTopN: number;
  totalTopN: number;
  excludedUrls?: Set<string>;
}

interface FetchXmlOptions {
  timeoutMs: number;
  retryCount: number;
  userAgent: string;
  logger: Pick<Logger, 'warn'>;
  fetchFn: typeof fetch;
}

const XML_ACCEPT_HEADER = 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9,*/*;q=0.8';

export function applySectionAndGlobalLimits({
  itemsBySection,
  sectionOrder,
  sectionTopN,
  totalTopN,
  excludedUrls
}: ApplySectionAndGlobalLimitsOptions): Record<string, NormalizedNewsItem[]> {
  const normalizedSectionTopN = Math.max(0, sectionTopN);
  const normalizedTotalTopN = Math.max(0, totalTopN);
  const seenUrls = new Set(excludedUrls ?? []);
  const perSectionLimited: Record<string, NormalizedNewsItem[]> = {};

  for (const section of sectionOrder) {
    const sorted = [...(itemsBySection[section] ?? [])].sort((a, b) => b.publishedAt - a.publishedAt);
    const selected: NormalizedNewsItem[] = [];

    for (const item of sorted) {
      if (seenUrls.has(item.url)) {
        continue;
      }

      seenUrls.add(item.url);
      selected.push(item);

      if (selected.length >= normalizedSectionTopN) {
        break;
      }
    }

    perSectionLimited[section] = selected;
  }

  const withTotalLimit: Record<string, NormalizedNewsItem[]> = {};
  let remaining = normalizedTotalTopN;

  for (const section of sectionOrder) {
    if (remaining <= 0) {
      withTotalLimit[section] = [];
      continue;
    }

    const selected = perSectionLimited[section] ?? [];
    const limited = selected.slice(0, remaining);
    withTotalLimit[section] = limited;
    remaining -= limited.length;
  }

  return withTotalLimit;
}

export async function fetchFeeds(options: FetchFeedsOptions): Promise<FetchFeedsResult> {
  const parser = new Parser();
  const fetchFn = options.fetchFn ?? fetch;
  const itemsBySection: Record<string, NormalizedNewsItem[]> = {};
  const sectionOrder = options.sectionFeeds.map((entry) => entry.section);
  let failedFeedCount = 0;

  for (const { section, urls } of options.sectionFeeds) {
    itemsBySection[section] = [];

    for (const feedUrl of urls) {
      try {
        const xml = await fetchFeedXml(feedUrl, {
          timeoutMs: options.timeoutMs,
          retryCount: options.retryCount,
          userAgent: options.userAgent,
          logger: options.logger,
          fetchFn
        });
        const parsedFeed = await parser.parseString(xml);
        const sourceFallback =
          (typeof parsedFeed.title === 'string' && parsedFeed.title.trim()) ||
          getDomainFromUrl(feedUrl) ||
          section;

        for (const feedItem of parsedFeed.items ?? []) {
          const normalized = normalizeItem({
            item: feedItem,
            section,
            sourceFallback
          });

          if (normalized) {
            itemsBySection[section].push(normalized);
          }
        }
      } catch (error) {
        failedFeedCount += 1;
        options.logger.warn('RSS feed fetch failed. Continue with next feed.', {
          section,
          feedUrl,
          reason: toErrorMessage(error)
        });
      }
    }

    itemsBySection[section].sort((a, b) => b.publishedAt - a.publishedAt);
  }

  const sectionItems = applySectionAndGlobalLimits({
    itemsBySection,
    sectionOrder,
    sectionTopN: options.sectionTopN,
    totalTopN: options.totalTopN,
    excludedUrls: options.excludedUrls
  });

  const fetchedItemCount = sectionOrder.reduce(
    (count, section) => count + (sectionItems[section]?.length ?? 0),
    0
  );

  return {
    sectionOrder,
    sectionItems,
    fetchedItemCount,
    failedFeedCount
  };
}

async function fetchFeedXml(url: string, options: FetchXmlOptions): Promise<string> {
  return retry(
    async () => {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => {
        controller.abort();
      }, options.timeoutMs);

      try {
        const response = await options.fetchFn(url, {
          method: 'GET',
          headers: {
            'User-Agent': options.userAgent,
            Accept: XML_ACCEPT_HEADER
          },
          signal: controller.signal
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return await response.text();
      } finally {
        clearTimeout(timeoutHandle);
      }
    },
    {
      retries: options.retryCount,
      delayMs: 250,
      onRetry: (error, attempt) => {
        options.logger.warn('Retry RSS feed fetch.', {
          url,
          attempt,
          reason: toErrorMessage(error)
        });
      }
    }
  );
}
