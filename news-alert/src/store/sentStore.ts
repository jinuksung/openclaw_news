import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { daysToMs } from '../utils/time';

interface SentStoreFile {
  version: number;
  sent: Array<{
    url: string;
    sentAt: string;
  }>;
}

const STORE_VERSION = 1;
const DEFAULT_TTL_DAYS = 7;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function pruneExpiredSentLinks(
  links: Map<string, string>,
  now: Date,
  ttlDays: number = DEFAULT_TTL_DAYS
): Map<string, string> {
  const threshold = now.getTime() - daysToMs(ttlDays);
  const pruned = new Map<string, string>();

  for (const [url, sentAtIso] of links.entries()) {
    const sentAtMs = Date.parse(sentAtIso);
    if (!Number.isNaN(sentAtMs) && sentAtMs >= threshold) {
      pruned.set(url, new Date(sentAtMs).toISOString());
    }
  }

  return pruned;
}

export function recordSentLinks(
  existing: Map<string, string>,
  urls: string[],
  sentAt: Date = new Date()
): Map<string, string> {
  const next = new Map(existing);
  const sentAtIso = sentAt.toISOString();

  for (const url of urls) {
    if (!url.trim()) {
      continue;
    }
    next.set(url, sentAtIso);
  }

  return next;
}

export async function loadSentLinks(
  filePath: string,
  now: Date = new Date(),
  ttlDays: number = DEFAULT_TTL_DAYS
): Promise<Map<string, string>> {
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    const map = parseSentStore(parsed);
    return pruneExpiredSentLinks(map, now, ttlDays);
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      return new Map();
    }

    throw error;
  }
}

export async function saveSentLinks(filePath: string, links: Map<string, string>): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });

  const payload: SentStoreFile = {
    version: STORE_VERSION,
    sent: Array.from(links.entries()).map(([url, sentAt]) => ({ url, sentAt }))
  };

  const tempFilePath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempFilePath, JSON.stringify(payload, null, 2), 'utf8');
  await rename(tempFilePath, filePath);
}

function parseSentStore(parsed: unknown): Map<string, string> {
  if (!isRecord(parsed)) {
    return new Map();
  }

  const sent = parsed.sent;
  if (!Array.isArray(sent)) {
    return new Map();
  }

  const map = new Map<string, string>();

  for (const entry of sent) {
    if (!isRecord(entry)) {
      continue;
    }

    const url = entry.url;
    const sentAt = entry.sentAt;
    if (typeof url !== 'string' || typeof sentAt !== 'string') {
      continue;
    }

    map.set(url, sentAt);
  }

  return map;
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}
