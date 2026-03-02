# Article Archive Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the run-once RSS pipeline to fetch each selected article page, extract readable body text, and save one JSONL record per article alongside the existing Telegram delivery.

**Architecture:** Keep the RSS selection flow unchanged, then add an article-archiving stage between feed filtering and Telegram send. The archive stage will fetch each article URL with timeout/retry, extract text via Readability with an RSS-summary fallback, and persist daily JSONL files under `data/articles/` using a safe write path.

**Tech Stack:** TypeScript, Node.js fetch, `@mozilla/readability`, `jsdom`, Vitest.

---

### Task 1: Add archive tests

**Files:**
- Create: `news-alert/src/archive/archiveArticles.test.ts`
- Create: `news-alert/src/archive/articleExtractor.test.ts`

**Step 1: Write the failing test**
- Cover extraction success from article HTML.
- Cover fallback to RSS summary when extraction fails.
- Cover JSONL output with one record per article.

**Step 2: Run test to verify it fails**
Run: `npm test -- src/archive/articleExtractor.test.ts src/archive/archiveArticles.test.ts`
Expected: FAIL due to missing modules.

**Step 3: Write minimal implementation**
- Add archive record types.
- Add extractor helper and JSONL writer.

**Step 4: Run test to verify it passes**
Run: `npm test -- src/archive/articleExtractor.test.ts src/archive/archiveArticles.test.ts`
Expected: PASS.

### Task 2: Wire archive flow into run-once pipeline

**Files:**
- Modify: `news-alert/src/index.ts`
- Modify: `news-alert/package.json`
- Modify: `news-alert/.env.example`

**Step 1: Write the failing test**
- Add focused tests for integration helper if needed, otherwise rely on module tests and typecheck.

**Step 2: Implement minimal orchestration**
- Flatten selected items.
- Archive current run's articles before Telegram send.
- Keep failures isolated per article.

**Step 3: Verify**
Run: `npm run typecheck && npm test`
Expected: PASS.

### Task 3: Document archive output

**Files:**
- Modify: `news-alert/README.md`

**Step 1: Update docs**
- Explain `data/articles/YYYY-MM-DD.jsonl` output.
- Explain content extraction and RSS summary fallback.

**Step 2: Verify final quality gates**
Run: `npm run typecheck && npm run lint && npm run build && npm test`
Expected: all pass.
