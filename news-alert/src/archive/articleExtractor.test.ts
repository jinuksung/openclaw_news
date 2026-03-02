import { describe, expect, it } from 'vitest';

import { extractArticleContent } from './articleExtractor';

describe('extractArticleContent', () => {
  it('extracts readable text from article html', () => {
    const result = extractArticleContent({
      url: 'https://example.com/post',
      html: `
        <html>
          <head><title>Example</title></head>
          <body>
            <article>
              <h1>Example headline</h1>
              <p>First paragraph.</p>
              <p>Second paragraph.</p>
            </article>
          </body>
        </html>
      `,
      fallbackText: 'rss summary'
    });

    expect(result.content).toContain('First paragraph.');
    expect(result.content).toContain('Second paragraph.');
    expect(result.extractionMode).toBe('article');
  });

  it('falls back to rss summary when article extraction fails', () => {
    const result = extractArticleContent({
      url: 'https://example.com/post',
      html: '<html><body><div>no article</div></body></html>',
      fallbackText: 'rss summary fallback'
    });

    expect(result.content).toBe('rss summary fallback');
    expect(result.extractionMode).toBe('rss-summary');
  });
});
