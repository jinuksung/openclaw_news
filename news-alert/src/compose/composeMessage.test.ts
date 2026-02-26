import { describe, expect, it } from 'vitest';

import { composeMessages } from './composeMessage';

describe('composeMessages', () => {
  it('escapes HTML and renders sectioned lines', () => {
    const chunks = composeMessages({
      dateKst: '2026-02-26',
      sectionOrder: ['AI'],
      sectionItems: {
        AI: [
          {
            section: 'AI',
            title: 'AI <Fast> & Safe',
            url: 'https://example.com/a?x=1&y=2',
            source: 'Feed <Name>',
            publishedAt: Date.now(),
            summary: '',
            publishedAtIso: new Date().toISOString()
          }
        ]
      },
      summary: {
        overallLines: ['첫째 줄', '둘째 줄', '셋째 줄'],
        sectionLines: {
          AI: 'AI 섹션 요약'
        }
      }
    });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toContain('🗞️ 오늘의 뉴스 (2026-02-26)');
    expect(chunks[0]).toContain('AI &lt;Fast&gt; &amp; Safe');
    expect(chunks[0]).toContain('Feed &lt;Name&gt;');
    expect(chunks[0]).toContain('<a href="https://example.com/a?x=1&amp;y=2">링크</a>');
  });

  it('splits message under 4096 characters', () => {
    const longTitle = 'a'.repeat(1000);
    const chunks = composeMessages({
      dateKst: '2026-02-26',
      sectionOrder: ['AI'],
      sectionItems: {
        AI: Array.from({ length: 8 }, (_, index) => ({
          section: 'AI',
          title: `${index}-${longTitle}`,
          url: `https://example.com/${index}`,
          source: 'Feed',
          publishedAt: Date.now() - index,
          summary: '',
          publishedAtIso: new Date().toISOString()
        }))
      }
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 4096)).toBe(true);
  });
});
