import type { NormalizedNewsItem } from '../rss/normalizeItem';

export interface SummaryInput {
  dateKst: string;
  sectionOrder: string[];
  sectionItems: Record<string, NormalizedNewsItem[]>;
  totalTopK: number;
  perSectionTopK: number;
}

export interface SummaryResult {
  overallLines: string[];
  sectionLines: Record<string, string>;
}

export interface Summarizer {
  summarize(input: SummaryInput): Promise<SummaryResult>;
}
