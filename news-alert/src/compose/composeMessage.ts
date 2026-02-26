import type { NormalizedNewsItem } from '../rss/normalizeItem';

export interface ComposedSummary {
  overallLines: string[];
  sectionLines: Record<string, string>;
}

export interface ComposeMessagesInput {
  dateKst: string;
  sectionOrder: string[];
  sectionItems: Record<string, NormalizedNewsItem[]>;
  summary?: ComposedSummary;
  maxLength?: number;
}

const TELEGRAM_MAX_MESSAGE_LENGTH = 4096;

export function composeMessages(input: ComposeMessagesInput): string[] {
  const lines: string[] = [];

  lines.push(`<b>🗞️ 오늘의 뉴스 (${escapeHtml(input.dateKst)})</b>`);

  if (input.summary && input.summary.overallLines.length > 0) {
    lines.push('');
    lines.push('<b>오늘의 핵심 3줄</b>');

    for (const line of input.summary.overallLines.slice(0, 3)) {
      lines.push(`- ${escapeHtml(line)}`);
    }
  }

  let hasAnyItem = false;

  for (const section of input.sectionOrder) {
    const items = input.sectionItems[section] ?? [];
    if (items.length === 0) {
      continue;
    }

    hasAnyItem = true;
    lines.push('');
    lines.push(`<b>[${escapeHtml(section)}]</b>`);

    const sectionSummary = input.summary?.sectionLines[section]?.trim();
    if (sectionSummary) {
      lines.push(`요약: ${escapeHtml(sectionSummary)}`);
    }

    for (const item of items) {
      lines.push(formatItemLine(item));
    }
  }

  if (!hasAnyItem) {
    lines.push('');
    lines.push('전송할 새 뉴스가 없습니다.');
  }

  return splitMessageByLength(lines, input.maxLength ?? TELEGRAM_MAX_MESSAGE_LENGTH);
}

function formatItemLine(item: NormalizedNewsItem): string {
  const title = truncate(item.title, 1800);
  const source = item.source || 'unknown-source';

  return `• ${escapeHtml(title)} — (${escapeHtml(source)}) <a href="${escapeHtmlAttribute(item.url)}">링크</a>`;
}

function splitMessageByLength(lines: string[], maxLength: number): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  for (const rawLine of lines) {
    const line = rawLine.length > maxLength ? `${rawLine.slice(0, maxLength - 1)}…` : rawLine;
    const candidate = currentChunk ? `${currentChunk}\n${line}` : line;

    if (candidate.length <= maxLength) {
      currentChunk = candidate;
      continue;
    }

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    currentChunk = line;
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {
    return text;
  }

  return `${text.slice(0, Math.max(1, max - 1))}…`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}
