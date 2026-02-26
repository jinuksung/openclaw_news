import { describe, expect, it } from 'vitest';

import { applySectionAndGlobalLimits } from './fetchFeeds';
import type { NormalizedNewsItem } from './normalizeItem';

function item(section: string, url: string, publishedAt: number): NormalizedNewsItem {
  return {
    section,
    title: `${section}-${url}`,
    url,
    publishedAt,
    source: section,
    summary: '',
    publishedAtIso: new Date(publishedAt).toISOString()
  };
}

describe('applySectionAndGlobalLimits', () => {
  it('applies section limit, global dedupe, and total limit by section order priority', () => {
    const sectionOrder = ['AI', '주식'];
    const itemsBySection: Record<string, NormalizedNewsItem[]> = {
      AI: [
        item('AI', 'https://a.com/1', 1000),
        item('AI', 'https://dup.com/1', 900),
        item('AI', 'https://a.com/2', 800)
      ],
      주식: [
        item('주식', 'https://s.com/1', 1100),
        item('주식', 'https://dup.com/1', 950),
        item('주식', 'https://s.com/2', 700)
      ]
    };

    const selected = applySectionAndGlobalLimits({
      itemsBySection,
      sectionOrder,
      sectionTopN: 2,
      totalTopN: 3
    });

    expect(selected.AI?.map((v) => v.url)).toEqual(['https://a.com/1', 'https://dup.com/1']);
    expect(selected['주식']?.map((v) => v.url)).toEqual(['https://s.com/1']);
    const flattened = sectionOrder.flatMap((section) => selected[section] ?? []);
    expect(flattened).toHaveLength(3);
    expect(flattened.map((v) => v.url)).toEqual([
      'https://a.com/1',
      'https://dup.com/1',
      'https://s.com/1'
    ]);
  });
});
