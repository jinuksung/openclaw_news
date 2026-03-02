import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

export interface ExtractArticleContentInput {
  url: string;
  html: string;
  fallbackText: string;
}

export interface ExtractArticleContentResult {
  content: string;
  extractionMode: 'article' | 'body' | 'rss-summary' | 'empty';
}

export function extractArticleContent(
  input: ExtractArticleContentInput
): ExtractArticleContentResult {
  const dom = new JSDOM(input.html, { url: input.url });
  const readable = new Readability(dom.window.document).parse();
  const articleText = cleanText(readable?.textContent ?? '');

  if (articleText.length >= 30) {
    return {
      content: articleText,
      extractionMode: 'article'
    };
  }

  const bodyText = cleanText(dom.window.document.body?.textContent ?? '');
  if (bodyText.length >= 280) {
    return {
      content: bodyText,
      extractionMode: 'body'
    };
  }

  const fallbackText = cleanText(input.fallbackText);
  if (fallbackText) {
    return {
      content: fallbackText,
      extractionMode: 'rss-summary'
    };
  }

  return {
    content: '',
    extractionMode: 'empty'
  };
}

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
