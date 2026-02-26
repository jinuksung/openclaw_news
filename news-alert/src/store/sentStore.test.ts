import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { loadSentLinks, pruneExpiredSentLinks, recordSentLinks, saveSentLinks } from './sentStore';

describe('sentStore', () => {
  const cleanupPaths: string[] = [];

  afterEach(async () => {
    await Promise.all(cleanupPaths.splice(0).map((path) => rm(path, { recursive: true, force: true })));
  });

  it('returns empty map when file is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sent-store-'));
    cleanupPaths.push(dir);

    const links = await loadSentLinks(join(dir, 'missing.json'), new Date('2026-02-26T00:00:00.000Z'));
    expect(links.size).toBe(0);
  });

  it('prunes links older than 7 days', () => {
    const now = new Date('2026-02-26T00:00:00.000Z');
    const links = new Map<string, string>([
      ['https://recent.com', '2026-02-24T00:00:00.000Z'],
      ['https://old.com', '2026-02-10T00:00:00.000Z']
    ]);

    const pruned = pruneExpiredSentLinks(links, now, 7);

    expect(pruned.has('https://recent.com')).toBe(true);
    expect(pruned.has('https://old.com')).toBe(false);
  });

  it('writes atomically and loads same links', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sent-store-'));
    cleanupPaths.push(dir);

    const filePath = join(dir, 'sent.json');
    const now = new Date('2026-02-26T00:00:00.000Z');
    const recorded = recordSentLinks(new Map(), ['https://a.com', 'https://b.com'], now);

    await saveSentLinks(filePath, recorded);
    const loaded = await loadSentLinks(filePath, now);

    expect(loaded.size).toBe(2);
    expect(loaded.has('https://a.com')).toBe(true);
    expect(loaded.has('https://b.com')).toBe(true);

    const files = await readdir(dir);
    expect(files.some((name) => name.includes('.tmp'))).toBe(false);
  });
});
