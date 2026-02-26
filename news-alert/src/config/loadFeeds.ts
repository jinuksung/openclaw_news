import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import type { SectionFeedConfig } from '../rss/fetchFeeds';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateUrls(section: string, rawUrls: unknown): string[] {
  if (!Array.isArray(rawUrls)) {
    throw new Error(`Section "${section}" must be an array of feed URLs.`);
  }

  const urls = rawUrls
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (urls.length === 0) {
    throw new Error(`Section "${section}" must include at least one non-empty feed URL.`);
  }

  return Array.from(new Set(urls));
}

export async function loadFeeds(
  configPath: string = resolve(process.cwd(), 'config/feeds.json')
): Promise<SectionFeedConfig[]> {
  const fileContent = await readFile(configPath, 'utf8');
  const parsed: unknown = JSON.parse(fileContent);

  if (!isRecord(parsed)) {
    throw new Error('config/feeds.json must be a JSON object of { section: [url, ...] }.');
  }

  const feeds: SectionFeedConfig[] = [];

  for (const [section, rawUrls] of Object.entries(parsed)) {
    const normalizedSection = section.trim();
    if (!normalizedSection) {
      continue;
    }

    feeds.push({
      section: normalizedSection,
      urls: validateUrls(normalizedSection, rawUrls)
    });
  }

  if (feeds.length === 0) {
    throw new Error('No feed section found in config/feeds.json. Check config/feeds.example.json.');
  }

  return feeds;
}
