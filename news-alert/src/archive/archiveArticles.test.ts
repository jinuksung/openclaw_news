import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  archiveArticles,
  buildArticleArchivePath,
  type ArchivedArticleRecord
} from './archiveArticles';

const cleanupPaths: string[] = [];

afterEach(async () => {
  await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('buildArticleArchivePath', () => {
  it('creates daily jsonl path', () => {
    expect(buildArticleArchivePath('/base', '2026-02-28')).toBe('/base/data/articles/2026-02-28.jsonl');
  });
});

describe('archiveArticles', () => {
  it('writes one json line per archived article', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'archive-articles-'));
    cleanupPaths.push(dir);

    await archiveArticles({
      baseDir: dir,
      dateKst: '2026-02-28',
      items: [
        {
          section: 'AI',
          title: 'Headline',
          url: 'https://example.com/a',
          source: 'Example',
          summary: 'rss summary',
          publishedAt: 1,
          publishedAtIso: '2026-02-28T00:00:00.000Z'
        }
      ],
      fetchHtml: vi
        .fn()
        .mockResolvedValue(
          '<html><body><article><h1>Headline</h1><p>Body text first paragraph.</p><p>Body text second paragraph.</p></article></body></html>'
        ),
      now: new Date('2026-02-28T01:02:03.000Z'),
      logger: {
        info: vi.fn(),
        warn: vi.fn()
      }
    });

    const output = await readFile(join(dir, 'data/articles/2026-02-28.jsonl'), 'utf8');
    const records: ArchivedArticleRecord[] = output
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line) as ArchivedArticleRecord);

    expect(records).toHaveLength(1);
    expect(records[0].title).toBe('Headline');
    expect(records[0].content).toContain('Body text first paragraph.');
    expect(records[0].extractionMode).toBe('article');
    expect(records[0].fetchedAtIso).toBe('2026-02-28T01:02:03.000Z');
  });

  it('logs fetch failures and extraction mode counts', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'archive-articles-'));
    cleanupPaths.push(dir);
    const info = vi.fn();
    const warn = vi.fn();

    const records = await archiveArticles({
      baseDir: dir,
      dateKst: '2026-02-28',
      items: [
        {
          section: 'AI',
          title: 'Headline',
          url: 'https://example.com/fail',
          source: 'Example',
          summary: 'rss summary',
          publishedAt: 1,
          publishedAtIso: '2026-02-28T00:00:00.000Z'
        }
      ],
      fetchHtml: vi.fn().mockRejectedValue(new Error('HTTP 403')),
      now: new Date('2026-02-28T01:02:03.000Z'),
      logger: { info, warn }
    });

    expect(records[0].extractionMode).toBe('rss-summary');
    expect(warn).toHaveBeenCalledWith(
      'Article fetch failed. Save RSS summary fallback.',
      expect.objectContaining({
        url: 'https://example.com/fail',
        reason: 'HTTP 403'
      })
    );
    expect(info).toHaveBeenCalledWith(
      'Archived article records.',
      expect.objectContaining({
        count: 1,
        extractionModes: {
          'rss-summary': 1
        }
      })
    );
  });

  it('warns when extraction produces empty content', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'archive-articles-'));
    cleanupPaths.push(dir);
    const info = vi.fn();
    const warn = vi.fn();

    const records = await archiveArticles({
      baseDir: dir,
      dateKst: '2026-02-28',
      items: [
        {
          section: 'AI',
          title: 'Headline',
          url: 'https://example.com/empty',
          source: 'Example',
          summary: '',
          publishedAt: 1,
          publishedAtIso: '2026-02-28T00:00:00.000Z'
        }
      ],
      fetchHtml: vi.fn().mockResolvedValue('<html><body><div>short</div></body></html>'),
      now: new Date('2026-02-28T01:02:03.000Z'),
      logger: { info, warn }
    });

    expect(records[0].extractionMode).toBe('empty');
    expect(warn).toHaveBeenCalledWith(
      'Article extraction produced empty content.',
      expect.objectContaining({
        url: 'https://example.com/empty',
        source: 'Example',
        section: 'AI'
      })
    );
    expect(info).toHaveBeenCalledWith(
      'Archived article records.',
      expect.objectContaining({
        count: 1,
        extractionModes: {
          empty: 1
        }
      })
    );
  });
});
