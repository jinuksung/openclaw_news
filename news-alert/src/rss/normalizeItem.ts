import type Parser from 'rss-parser';

export interface NormalizedNewsItem {
  section: string;
  title: string;
  url: string;
  source: string;
  summary: string;
  publishedAt: number;
  publishedAtIso: string;
}

export interface NormalizeItemInput {
  item: Parser.Item;
  section: string;
  sourceFallback: string;
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function normalizeUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

export function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return 'unknown-source';
  }
}

function resolvePublishedAt(item: Parser.Item): { publishedAt: number; publishedAtIso: string } {
  const fallback = {
    publishedAt: 0,
    publishedAtIso: '1970-01-01T00:00:00.000Z'
  };

  const candidates: string[] = [];

  if (typeof item.isoDate === 'string') {
    candidates.push(item.isoDate);
  }
  if (typeof item.pubDate === 'string') {
    candidates.push(item.pubDate);
  }

  const unknownItem = item as Record<string, unknown>;
  const atomUpdated = unknownItem.updated;
  const atomPublished = unknownItem.published;

  if (typeof atomUpdated === 'string') {
    candidates.push(atomUpdated);
  }
  if (typeof atomPublished === 'string') {
    candidates.push(atomPublished);
  }

  for (const candidate of candidates) {
    const timestamp = Date.parse(candidate);
    if (!Number.isNaN(timestamp)) {
      return {
        publishedAt: timestamp,
        publishedAtIso: new Date(timestamp).toISOString()
      };
    }
  }

  return fallback;
}

function resolveSummary(item: Parser.Item): string {
  const unknownItem = item as Record<string, unknown>;
  const candidates = [
    item.contentSnippet,
    item.summary,
    item.content,
    unknownItem['content:encoded'],
    unknownItem.description
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const cleaned = cleanText(candidate);
      if (cleaned) {
        return cleaned;
      }
    }
  }

  return '';
}

export function normalizeItem({ item, section, sourceFallback }: NormalizeItemInput): NormalizedNewsItem | null {
  const rawUrl = typeof item.link === 'string' ? item.link : '';
  const url = normalizeUrl(rawUrl);
  if (!url) {
    return null;
  }

  const title = cleanText(typeof item.title === 'string' ? item.title : '') || '(제목 없음)';
  const source = cleanText(sourceFallback) || getDomainFromUrl(url);
  const { publishedAt, publishedAtIso } = resolvePublishedAt(item);

  return {
    section,
    title,
    url,
    source,
    summary: resolveSummary(item),
    publishedAt,
    publishedAtIso
  };
}
