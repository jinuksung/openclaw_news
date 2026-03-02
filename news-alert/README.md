# news-alert

여러 RSS/Atom 피드를 섹션(주제)별로 읽어 1회 실행(run-once)으로 텔레그램에 뉴스 링크/헤드라인(선택: AI 요약) 전송하는 TypeScript 프로그램입니다.

- 스케줄러/크론/pm2/systemd 자동화는 포함하지 않습니다.
- 수동 실행만 가정합니다: `node dist/index.js` 또는 `npm run run-once`

## 1) 피드 설정 (`config/feeds.json`)

섹션별 피드 URL 배열을 넣습니다. key 순서가 섹션 우선순위입니다(전체 Top N 초과 시 앞 섹션 우선).

```json
{
  "AI": ["https://example.com/ai/rss", "https://example.com/ai/feed"],
  "주식": ["https://example.com/stocks/rss"],
  "육아": ["https://example.com/parenting/rss"],
  "게임": ["https://example.com/games/rss"]
}
```

- 예시 파일: `config/feeds.example.json`
- 실제 실행 파일: `config/feeds.json`

## 2) 환경 변수 (`.env`)

`.env.example`를 복사해 `.env`를 만드세요.

```bash
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Optional AI summary
ENABLE_AI_SUMMARY=false
OPENAI_API_KEY=
SUMMARY_TOTAL_TOP_K=8
SUMMARY_PER_SECTION_TOP_K=3

# Optional tuning
SECTION_TOP_N=5
TOTAL_TOP_N=20
FEED_TIMEOUT_MS=10000
FEED_RETRY_COUNT=1
ARTICLE_FETCH_TIMEOUT_MS=10000
ARTICLE_FETCH_RETRY_COUNT=1
TELEGRAM_RETRY_COUNT=1
```

## 3) 실행 방법

```bash
npm i
npm run build
npm run run-once
```

또는 빌드 후 직접 실행:

```bash
node dist/index.js
```

## 4) 동작 요약

- 섹션별 최신 글을 수집 후 발행일 내림차순 정렬
- 전역 URL 중복 제거(섹션 간 중복도 1회만 유지)
- `SECTION_TOP_N`(기본 5), `TOTAL_TOP_N`(기본 20) 제한
- 피드별 실패 격리(try/catch), 타임아웃 10초, 재시도 1회
- Telegram HTML ParseMode 사용, 메시지 4096자 초과 시 자동 분할 전송
- Telegram 네트워크 실패 시 재시도 1회, 429 시 `Retry-After` 반영 후 1회 재시도
- 선택된 기사 원문은 `data/articles/YYYY-MM-DD.jsonl`에 저장
- 로그 파일: `logs/news-alert.log`

## 5) AI 요약(옵션)

`ENABLE_AI_SUMMARY=true`이고 `OPENAI_API_KEY`가 있을 때만 동작합니다.

- RSS의 `title + summary/excerpt`만 사용합니다.
- 웹 본문 크롤링/브라우저 자동화는 하지 않습니다.
- 출력:
  - 제목 아래 `오늘의 핵심 3줄`
  - 섹션별 1~2줄 요약
- 범위 제어:
  - `SUMMARY_TOTAL_TOP_K` (기본 8)
  - `SUMMARY_PER_SECTION_TOP_K` (기본 3)

## 6) 중복 발송 방지 (`data/sent.json`)

최근 7일간 발송한 링크를 저장합니다.

- 같은 URL은 재발송하지 않습니다.
- 저장은 atomic write(임시파일 작성 후 rename)로 처리합니다.
- 7일이 지난 항목은 자동 만료/정리됩니다.

## 6-1) 기사 원문 아카이브 (`data/articles/YYYY-MM-DD.jsonl`)

이번 실행에서 선택된 기사들은 날짜별 JSONL 파일에 저장됩니다.

- 경로 예시: `data/articles/2026-02-28.jsonl`
- 기사 1건당 1줄 JSON
- 포함 필드:
  - `section`
  - `source`
  - `title`
  - `url`
  - `publishedAtIso`
  - `rssSummary`
  - `content`
  - `extractionMode`
  - `fetchedAtIso`
- 저장 정책:
  - 같은 날짜 파일 안에서는 `url` 기준으로 덮어써 중복을 줄임
  - 기사 본문 추출에 실패하면 RSS summary를 fallback으로 저장

## 7) 트러블슈팅

## 7-1) 현재 피드 점검 메모

2026-03-02 기준으로 `feeds.json`에 들어 있는 현재 피드들은 재검증 후 정리된 상태입니다.

- summary 미지원 피드 제거:
  - `https://www.hankyung.com/feed/finance`
  - `https://www.hankyung.com/feed/all-news`
- 응답 오류/파싱 실패 피드 제거:
  - `https://www.reutersagency.com/feed/?best-topics=technology`
  - `https://www.etnews.com/rss/etnews.xml`
  - `https://it.donga.com/feeds/`
  - `https://www.bloter.net/feed`
  - `https://biz.chosun.com/rss/all.xml`
  - `https://www.dt.co.kr/rss/all.xml`
  - `https://www.mk.co.kr/rss/40000001/`
- 대체 피드 반영:
  - `https://techcrunch.com/category/artificial-intelligence/feed/`
  - `https://it.donga.com/feeds/rss/news/`
  - `https://www.aitimes.com/rss/allArticle.xml`
  - `https://www.artificialintelligence-news.com/feed/`
  - `https://www.newsis.com/RSS/economy.xml`
  - `https://www.cnbc.com/id/100003114/device/rss/rss.html`
  - `https://www.marketwatch.com/rss/topstories`
  - `https://www.khan.co.kr/rss/rssdata/total_news.xml`
  - `https://www.hani.co.kr/rss/`
- 기사 원문 접근 제한으로 교체된 피드:
  - `https://openai.com/blog/rss.xml` -> 기사 페이지 `403`
  - `https://venturebeat.com/category/ai/feed/` -> 기사 페이지 `429`
  - `https://www.marketwatch.com/rss/topstories` -> 기사 페이지 `401`
  - `https://www.gamespot.com/feeds/news/` -> 기사 페이지 `403`
- 원문 추출 가능한 대체 피드 반영:
  - `https://www.theverge.com/rss/ai-artificial-intelligence/index.xml`
  - `https://www.infoq.com/feed/ai-ml-data-eng/`
  - `https://www.cnbc.com/id/10000664/device/rss/rss.html`
  - `https://www.pcgamer.com/rss/`

이 프로젝트는 RSS의 `description`, `summary`, `content:encoded` 중 하나라도 있으면 summary가 있는 피드로 간주하며, 현재 `feeds.json` 기준으로는 기사 원문 추출도 가능한 소스만 남겨 두었습니다.

### RSS 파싱 실패
- 일부 피드가 실패해도 전체 실행은 계속됩니다.
- `logs/news-alert.log`에서 실패한 피드 URL/에러를 확인하세요.
- 피드 URL이 실제 RSS/Atom 엔드포인트인지 확인하세요.

### Telegram 429(rate limit)
- `Retry-After` 헤더/값이 있으면 해당 시간만큼 대기 후 1회 재시도합니다.
- 반복 발생 시 한 번에 보내는 뉴스 수(`SECTION_TOP_N`, `TOTAL_TOP_N`)를 낮추세요.

### 메시지 길이 초과
- 메시지는 4096자 기준으로 자동 분할됩니다.
- 너무 긴 헤드라인이 많으면 `TOTAL_TOP_N`를 줄이거나 피드 수를 조정하세요.

### 타임존
- 날짜 표시는 `Asia/Seoul` 기준입니다.
- 서버 타임존과 무관하게 KST 날짜로 메시지 제목이 생성됩니다.

## 8) 보안

- 토큰/키는 코드에 하드코딩하지 마세요.
- `.env`를 사용하고, 로그에 민감정보가 남지 않도록 마스킹 처리되어 있습니다.
