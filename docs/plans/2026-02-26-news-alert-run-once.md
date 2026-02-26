# News Alert Run-Once Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a TypeScript run-once program that reads sectioned RSS feeds, deduplicates/filters items, and sends Telegram messages with optional OpenAI summary.

**Architecture:** A modular Node.js app with clear boundaries: config loading, RSS fetch/normalize, message composition/splitting, Telegram transport, sent-link persistence, and optional summarizer. The run entry orchestrates one pass end-to-end and exits.

**Tech Stack:** Node.js 20+, TypeScript, rss-parser, dotenv, OpenAI SDK, Vitest, ESLint, Prettier.

---

### Task 1: Bootstrap Project Skeleton

**Files:**
- Create: `news-alert/package.json`
- Create: `news-alert/tsconfig.json`
- Create: `news-alert/.eslintrc.cjs`
- Create: `news-alert/.prettierrc`
- Create: `news-alert/.gitignore`
- Create: `news-alert/.env.example`
- Create: `news-alert/config/feeds.example.json`
- Create: `news-alert/config/feeds.json`
- Create: `news-alert/src/**` directories

**Step 1: Write the failing setup validation**
- Add a simple test file import check for required modules and expect failure before implementation.

**Step 2: Run test to verify it fails**
- Run: `npm test`
- Expected: FAIL due to missing source files.

**Step 3: Write minimal scaffolding**
- Create package scripts (dev/build/start/run-once/lint/format/typecheck/test).
- Create TypeScript and lint/format configs.

**Step 4: Run test to verify it passes**
- Run: `npm test`
- Expected: PASS for scaffold test.

### Task 2: Feed Selection Logic (TDD)

**Files:**
- Create: `news-alert/src/rss/fetchFeeds.ts`
- Create: `news-alert/src/rss/normalizeItem.ts`
- Test: `news-alert/src/rss/fetchFeeds.test.ts`

**Step 1: Write failing tests**
- Verify per-section sorting by published date desc.
- Verify global URL dedupe across sections.
- Verify SECTION_TOP_N and TOTAL_TOP_N with section priority by feed key order.
- Verify failed feed does not crash run.

**Step 2: Run tests to verify failures**
- Run: `npm test -- src/rss/fetchFeeds.test.ts`
- Expected: FAIL due to missing implementation.

**Step 3: Write minimal implementation**
- Fetch with 10s timeout, one retry, custom User-Agent.
- Parse via rss-parser and normalize fields.

**Step 4: Verify pass**
- Run same test command and ensure PASS.

### Task 3: Message Composition + Splitting (TDD)

**Files:**
- Create: `news-alert/src/compose/composeMessage.ts`
- Test: `news-alert/src/compose/composeMessage.test.ts`

**Step 1: Write failing tests**
- Verify section format, source fallback, escaped HTML output.
- Verify 4096-safe chunk splitting preserving line integrity.

**Step 2: Verify RED**
- Run: `npm test -- src/compose/composeMessage.test.ts`

**Step 3: Implement minimal composer**
- Build title + optional summary blocks + section lines.
- Split into chunks <= 4096 characters.

**Step 4: Verify GREEN**
- Re-run test and confirm pass.

### Task 4: Sent Store Persistence (TDD)

**Files:**
- Create: `news-alert/src/store/sentStore.ts`
- Test: `news-alert/src/store/sentStore.test.ts`

**Step 1: Write failing tests**
- Verify loading missing file returns empty map.
- Verify prune of older than 7 days.
- Verify atomic write creates final file with expected links.

**Step 2: Verify RED**
- Run: `npm test -- src/store/sentStore.test.ts`

**Step 3: Implement minimal persistence**
- JSON map of URL -> sentAt ISO.
- Write temp file then rename.

**Step 4: Verify GREEN**
- Re-run test and confirm pass.

### Task 5: Telegram Transport + Retry

**Files:**
- Create: `news-alert/src/telegram/sendMessage.ts`
- Create: `news-alert/src/utils/retry.ts`
- Test: `news-alert/src/telegram/sendMessage.test.ts`

**Step 1: Write failing tests**
- Verify network retry once on non-429 failure.
- Verify 429 honors Retry-After then retries once.

**Step 2: Verify RED**
- Run: `npm test -- src/telegram/sendMessage.test.ts`

**Step 3: Implement sender**
- Use Telegram `sendMessage` with HTML parse mode.
- Do not log secrets.

**Step 4: Verify GREEN**
- Re-run test and confirm pass.

### Task 6: Optional OpenAI Summarizer

**Files:**
- Create: `news-alert/src/summarize/Summarizer.ts`
- Create: `news-alert/src/summarize/openaiSummarizer.ts`

**Step 1: Write failing tests for prompt/shape handling (optional mocking)**
- Ensure section/overall summary contract and Korean output expectation in prompt.

**Step 2: Implement summarizer interface and OpenAI adapter**
- Responses API call with bounded inputs (`SUMMARY_TOTAL_TOP_K`, `SUMMARY_PER_SECTION_TOP_K`).

**Step 3: Verify with typecheck + selected tests**
- Run: `npm run typecheck && npm test`

### Task 7: Orchestration Entry + Docs

**Files:**
- Create: `news-alert/src/index.ts`
- Create: `news-alert/src/config/loadFeeds.ts`
- Create: `news-alert/src/utils/logger.ts`
- Create: `news-alert/src/utils/time.ts`
- Create: `news-alert/README.md`

**Step 1: Compose run-once pipeline**
- Load env/config -> fetch items -> filter sent -> optional summarize -> compose chunks -> send all -> persist sent state.

**Step 2: Verify full run commands**
- Run: `npm run build`
- Run: `npm run typecheck`
- Run: `npm test`

**Step 3: Final polish**
- Ensure README includes required sections.
- Ensure logs path and masking behavior are documented.
