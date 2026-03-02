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
});
