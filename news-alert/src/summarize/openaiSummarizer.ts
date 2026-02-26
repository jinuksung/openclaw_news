import OpenAI from 'openai';

import type { Logger } from '../utils/logger';
import { toErrorMessage } from '../utils/logger';
import type { Summarizer, SummaryInput, SummaryResult } from './Summarizer';

interface OpenAISummarizerOptions {
  apiKey: string;
  model?: string;
  logger: Pick<Logger, 'warn'>;
}

interface ParsedSummaryResponse {
  overallLines?: unknown;
  sectionLines?: unknown;
}

const EMPTY_SUMMARY: SummaryResult = {
  overallLines: [],
  sectionLines: {}
};

export class OpenAISummarizer implements Summarizer {
  private readonly client: OpenAI;

  private readonly model: string;

  private readonly logger: Pick<Logger, 'warn'>;

  public constructor(options: OpenAISummarizerOptions) {
    this.client = new OpenAI({ apiKey: options.apiKey });
    this.model = options.model ?? 'gpt-4.1-mini';
    this.logger = options.logger;
  }

  public async summarize(input: SummaryInput): Promise<SummaryResult> {
    const payload = buildSummaryPayload(input);

    if (payload.totalCandidates.length === 0) {
      return EMPTY_SUMMARY;
    }

    try {
      const response = await this.client.responses.create({
        model: this.model,
        instructions:
          '당신은 한국어 뉴스 요약가다. 반드시 한국어로만 작성하고 JSON만 반환한다. 추측하지 말고 제공된 title/summary만 활용한다.',
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: [
                  '아래 JSON 데이터를 바탕으로 요약해 주세요.',
                  '- overallLines: 정확히 3개의 문자열 배열',
                  '- sectionLines: 섹션별 1~2문장 요약 문자열',
                  '- 사실이 불명확하면 과장하지 말 것',
                  '',
                  JSON.stringify(payload)
                ].join('\n')
              }
            ]
          }
        ],
        temperature: 0.2
      });

      return parseSummaryResponse(response.output_text, input.sectionOrder);
    } catch (error) {
      this.logger.warn('OpenAI summary failed. Continue without summary.', {
        reason: toErrorMessage(error)
      });
      return EMPTY_SUMMARY;
    }
  }
}

function buildSummaryPayload(input: SummaryInput): {
  dateKst: string;
  totalCandidates: Array<{ section: string; title: string; summary: string }>;
  sectionCandidates: Record<string, Array<{ title: string; summary: string }>>;
} {
  const sectionCandidates: Record<string, Array<{ title: string; summary: string }>> = {};

  for (const section of input.sectionOrder) {
    const items = input.sectionItems[section] ?? [];
    sectionCandidates[section] = items.slice(0, Math.max(0, input.perSectionTopK)).map((item) => ({
      title: item.title,
      summary: item.summary
    }));
  }

  const totalCandidates = input.sectionOrder
    .flatMap((section) =>
      (input.sectionItems[section] ?? []).map((item) => ({
        section,
        title: item.title,
        summary: item.summary
      }))
    )
    .slice(0, Math.max(0, input.totalTopK));

  return {
    dateKst: input.dateKst,
    totalCandidates,
    sectionCandidates
  };
}

function parseSummaryResponse(outputText: string, sectionOrder: string[]): SummaryResult {
  const raw = unwrapCodeFence(outputText).trim();
  if (!raw) {
    return EMPTY_SUMMARY;
  }

  try {
    const parsed = JSON.parse(raw) as ParsedSummaryResponse;
    const overallLines = Array.isArray(parsed.overallLines)
      ? parsed.overallLines
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
          .slice(0, 3)
      : [];

    const sectionLines: Record<string, string> = {};
    if (typeof parsed.sectionLines === 'object' && parsed.sectionLines !== null) {
      const sectionRecord = parsed.sectionLines as Record<string, unknown>;
      for (const section of sectionOrder) {
        const value = sectionRecord[section];
        if (typeof value === 'string' && value.trim()) {
          sectionLines[section] = value.trim();
        }
      }
    }

    return {
      overallLines,
      sectionLines
    };
  } catch {
    return EMPTY_SUMMARY;
  }
}

function unwrapCodeFence(text: string): string {
  if (!text.startsWith('```')) {
    return text;
  }

  return text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '');
}
