import { describe, expect, it } from 'vitest';

import { extractArticleContent, shouldIgnoreJsdomWarning } from './articleExtractor';

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

  it('ignores jsdom css parse warnings as log noise', () => {
    expect(shouldIgnoreJsdomWarning('Could not parse CSS stylesheet')).toBe(true);
    expect(shouldIgnoreJsdomWarning('Could not parse CSS stylesheet: body { color: red; }')).toBe(true);
    expect(shouldIgnoreJsdomWarning('Uncaught [TypeError: boom]')).toBe(false);
  });

  it('does not surface css parse warnings through the warning callback', () => {
    const warnings: string[] = [];

    const result = extractArticleContent({
      url: 'https://example.com/post',
      html: `
        <html>
          <head><style>{</style></head>
          <body>
            <article>
              <p>First paragraph with enough text to produce a readable article result.</p>
              <p>Second paragraph with enough text to keep readability active for the test.</p>
            </article>
          </body>
        </html>
      `,
      fallbackText: '',
      onWarning: (warning) => {
        warnings.push(warning.message);
      }
    });

    expect(result.extractionMode).toBe('article');
    expect(warnings).toEqual([]);
  });
});
