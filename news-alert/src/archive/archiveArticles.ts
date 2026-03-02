import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { NormalizedNewsItem } from '../rss/normalizeItem';
import type { Logger } from '../utils/logger';
import { toErrorMessage } from '../utils/logger';
import { retry } from '../utils/retry';
import { extractArticleContent, type ExtractArticleContentResult } from './articleExtractor';

export interface ArchivedArticleRecord {
  section: string;
  source: string;
  title: string;
  url: string;
  publishedAtIso: string;
  rssSummary: string;
  content: string;
  extractionMode: ExtractArticleContentResult['extractionMode'];
  fetchedAtIso: string;
}

export interface ArchiveArticlesInput {
  baseDir: string;
  dateKst: string;
  items: NormalizedNewsItem[];
  now?: Date;
  fetchHtml?: (url: string) => Promise<string>;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  retryCount?: number;
  userAgent?: string;
  logger: Pick<Logger, 'info' | 'warn'>;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_COUNT = 1;
const DEFAULT_USER_AGENT = 'news-alert/1.0 (+article-archive)';

export function buildArticleArchivePath(baseDir: string, dateKst: string): string {
  return join(baseDir, 'data/articles', `${dateKst}.jsonl`);
}

export async function archiveArticles(input: ArchiveArticlesInput): Promise<ArchivedArticleRecord[]> {
  const archivePath = buildArticleArchivePath(input.baseDir, input.dateKst);
  const fetchHtml =
    input.fetchHtml ??
    ((url: string) =>
      fetchArticleHtml(url, {
        fetchFn: input.fetchFn ?? fetch,
        timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        retryCount: input.retryCount ?? DEFAULT_RETRY_COUNT,
        userAgent: input.userAgent ?? DEFAULT_USER_AGENT,
        logger: input.logger
      }));
  const fetchedAtIso = (input.now ?? new Date()).toISOString();
  const records: ArchivedArticleRecord[] = [];

  for (const item of input.items) {
    try {
      const html = await fetchHtml(item.url);
      const extracted = extractArticleContent({
        url: item.url,
        html,
        fallbackText: item.summary,
        onWarning: (warning) => {
          input.logger.warn('Article extraction warning.', {
            url: item.url,
            reason: warning.message
          });
        }
      });

      if (extracted.extractionMode === 'empty') {
        input.logger.warn('Article extraction produced empty content.', {
          section: item.section,
          source: item.source,
          url: item.url
        });
      }

      records.push({
        section: item.section,
        source: item.source,
        title: item.title,
        url: item.url,
        publishedAtIso: item.publishedAtIso,
        rssSummary: item.summary,
        content: extracted.content,
        extractionMode: extracted.extractionMode,
        fetchedAtIso
      });
    } catch (error) {
      input.logger.warn('Article fetch failed. Save RSS summary fallback.', {
        url: item.url,
        reason: toErrorMessage(error)
      });
      records.push({
        section: item.section,
        source: item.source,
        title: item.title,
        url: item.url,
        publishedAtIso: item.publishedAtIso,
        rssSummary: item.summary,
        content: item.summary,
        extractionMode: item.summary ? 'rss-summary' : 'empty',
        fetchedAtIso
      });
    }
  }

  await writeJsonlArchive(archivePath, records);
  input.logger.info('Archived article records.', {
    path: archivePath,
    count: records.length,
    extractionModes: countExtractionModes(records)
  });

  return records;
}

interface FetchArticleHtmlOptions {
  fetchFn: typeof fetch;
  timeoutMs: number;
  retryCount: number;
  userAgent: string;
  logger: Pick<Logger, 'warn'>;
}

async function fetchArticleHtml(url: string, options: FetchArticleHtmlOptions): Promise<string> {
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
            Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8'
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
      delayMs: 300,
      onRetry: (error, attempt) => {
        options.logger.warn('Retry article fetch.', {
          url,
          attempt,
          reason: toErrorMessage(error)
        });
      }
    }
  );
}

async function writeJsonlArchive(
  filePath: string,
  records: ArchivedArticleRecord[]
): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });

  const existing = await loadExistingRecords(filePath);
  const merged = new Map<string, ArchivedArticleRecord>();

  for (const record of existing) {
    merged.set(record.url, record);
  }
  for (const record of records) {
    merged.set(record.url, record);
  }

  const lines = Array.from(merged.values())
    .map((record) => JSON.stringify(record))
    .join('\n');
  const nextContent = lines ? `${lines}\n` : '';
  const tempFilePath = `${filePath}.${process.pid}.${Date.now()}.tmp`;

  await writeFile(tempFilePath, nextContent, 'utf8');
  await rename(tempFilePath, filePath);
}

async function loadExistingRecords(filePath: string): Promise<ArchivedArticleRecord[]> {
  try {
    const raw = await readFile(filePath, 'utf8');
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as ArchivedArticleRecord];
        } catch {
          return [];
        }
      });
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function countExtractionModes(
  records: ArchivedArticleRecord[]
): Partial<Record<ExtractArticleContentResult['extractionMode'], number>> {
  const counts: Partial<Record<ExtractArticleContentResult['extractionMode'], number>> = {};

  for (const record of records) {
    counts[record.extractionMode] = (counts[record.extractionMode] ?? 0) + 1;
  }

  return counts;
}
