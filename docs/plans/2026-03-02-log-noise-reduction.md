# Log Noise Reduction Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Suppress noisy `jsdom` CSS parsing warnings while preserving and improving logs for article archiving failures and degraded extraction.

**Architecture:** Filter `jsdom` `VirtualConsole` events at article extraction time so only known-non-actionable CSS parse warnings are dropped. Keep article archive logging in the archive layer, adding per-run extraction summaries and warnings only for meaningful degradation (`empty`) or fetch failures.

**Tech Stack:** TypeScript, Vitest, JSDOM, Readability

---

### Task 1: Define desired logging behavior with tests

**Files:**
- Modify: `/Users/JINUKSOUNG/Desktop/jinuk/news/news-alert/src/archive/articleExtractor.test.ts`
- Modify: `/Users/JINUKSOUNG/Desktop/jinuk/news/news-alert/src/archive/archiveArticles.test.ts`

**Step 1: Write a failing test for CSS warning suppression**
- Add a test that feeds HTML with an invalid stylesheet into `extractArticleContent`.
- Inject a warning sink and assert CSS parse noise is not reported.
- Also assert a non-CSS `jsdom` warning is still surfaced.

**Step 2: Write a failing test for archive log signal quality**
- Add a test where article fetch fails and assert a warning is logged.
- Add a test where extraction falls back to `empty` and assert a warning is logged.
- Assert archive completion info includes extraction mode counts.

**Step 3: Run targeted tests and confirm they fail for the intended reason**
- Run: `npm test -- src/archive/articleExtractor.test.ts src/archive/archiveArticles.test.ts`
- Expected: failures around missing warning filtering / missing summary logging.

### Task 2: Implement filtered extraction and meaningful archive logs

**Files:**
- Modify: `/Users/JINUKSOUNG/Desktop/jinuk/news/news-alert/src/archive/articleExtractor.ts`
- Modify: `/Users/JINUKSOUNG/Desktop/jinuk/news/news-alert/src/archive/archiveArticles.ts`

**Step 1: Add filtered `VirtualConsole` handling**
- Create a `VirtualConsole`.
- Ignore only `jsdomError` messages matching CSS stylesheet parse noise.
- Surface other `jsdomError` messages via an injected callback.

**Step 2: Improve archive logging**
- Log fetch failures as today.
- Warn when extraction result is `empty`.
- Include per-mode counts in the archive completion info log.

**Step 3: Keep implementation minimal**
- Avoid broad console monkey-patching.
- Avoid logging on successful `article` extraction per item.

### Task 3: Verify end-to-end

**Files:**
- Verify only

**Step 1: Run focused archive tests**
- Run: `npm test -- src/archive/articleExtractor.test.ts src/archive/archiveArticles.test.ts`

**Step 2: Run full project verification**
- Run: `npm run typecheck`
- Run: `npm run lint`
- Run: `npm run build`
- Run: `npm test`

**Step 3: Commit after verification**
- Stage only the changed plan/code/test files.
- Commit with a message describing log filtering/improvement.
