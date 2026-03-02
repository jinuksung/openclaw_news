import { Readability } from '@mozilla/readability';
import { JSDOM, VirtualConsole } from 'jsdom';

export interface ExtractArticleContentInput {
  url: string;
  html: string;
  fallbackText: string;
  onWarning?: (warning: ExtractArticleWarning) => void;
}

export interface ExtractArticleContentResult {
  content: string;
  extractionMode: 'article' | 'body' | 'rss-summary' | 'empty';
}

export interface ExtractArticleWarning {
  kind: 'jsdom';
  message: string;
}

export function extractArticleContent(
  input: ExtractArticleContentInput
): ExtractArticleContentResult {
  const dom = new JSDOM(input.html, {
    url: input.url,
    virtualConsole: createVirtualConsole(input.onWarning)
  });
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

function createVirtualConsole(
  onWarning: ExtractArticleContentInput['onWarning']
): VirtualConsole {
  const virtualConsole = new VirtualConsole();

  virtualConsole.on('jsdomError', (error) => {
    const message = toWarningMessage(error);
    if (shouldIgnoreJsdomWarning(message)) {
      return;
    }

    onWarning?.({
      kind: 'jsdom',
      message
    });
  });

  return virtualConsole;
}

function toWarningMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function shouldIgnoreJsdomWarning(message: string): boolean {
  return message.toLowerCase().includes('could not parse css stylesheet');
}
