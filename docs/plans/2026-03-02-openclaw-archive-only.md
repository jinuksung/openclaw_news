# OpenClaw Archive-Only Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a safe archive-only execution path so OpenClaw can consume new articles without built-in Telegram delivery, then document the exact prompt/workflow for OpenClaw.

**Architecture:** Reuse the existing delivery toggle by accepting `SKIP_TELEGRAM=true` as a higher-priority alias for disabling Telegram. Add an `archive-only` npm script that sets the flag before loading `dist/index.js`. Document the operator flow so OpenClaw reads the JSONL archive, summarizes/translates, sends to Telegram, and only then updates `sent.json`.

**Tech Stack:** TypeScript, Node.js, npm scripts, Vitest

---

### Task 1: Lock behavior with tests

**Files:**
- Modify: `/Users/JINUKSOUNG/Desktop/jinuk/news/news-alert/src/delivery/deliverNews.test.ts`

**Step 1: Write a failing test for `SKIP_TELEGRAM=true`**
- Assert `resolveTelegramDelivery()` returns `{ enabled: false }` when `SKIP_TELEGRAM=true`.
- Assert it does not require Telegram credentials in that case.

**Step 2: Run the focused test and confirm it fails**
- Run: `npm test -- src/delivery/deliverNews.test.ts`
- Expected: failure because `SKIP_TELEGRAM` is not handled yet.

### Task 2: Implement the archive-only path

**Files:**
- Modify: `/Users/JINUKSOUNG/Desktop/jinuk/news/news-alert/src/delivery/deliverNews.ts`
- Modify: `/Users/JINUKSOUNG/Desktop/jinuk/news/news-alert/package.json`
- Modify: `/Users/JINUKSOUNG/Desktop/jinuk/news/news-alert/.env.example`

**Step 1: Add `SKIP_TELEGRAM` alias**
- If `SKIP_TELEGRAM=true`, disable Telegram regardless of `ENABLE_TELEGRAM`.
- Keep existing `ENABLE_TELEGRAM=false` behavior intact.

**Step 2: Add `npm run archive-only`**
- Use a Node wrapper that sets `process.env.SKIP_TELEGRAM='true'` before requiring `dist/index.js`.
- Avoid shell-specific env assignment so the script is portable.

**Step 3: Expose the toggle in `.env.example`**
- Add `ENABLE_TELEGRAM=true` and `SKIP_TELEGRAM=false` with concise comments.

### Task 3: Document the OpenClaw workflow

**Files:**
- Modify: `/Users/JINUKSOUNG/Desktop/jinuk/news/news-alert/README.md`
- Create: `/Users/JINUKSOUNG/Desktop/jinuk/news/news-alert/docs/openclaw-prompt.md`

**Step 1: Update README**
- Document `archive-only` and `SKIP_TELEGRAM=true npm run run-once`.
- Clarify that `sent.json` is not updated in archive-only mode.

**Step 2: Add a copy-ready OpenClaw prompt**
- Include command execution, JSONL read path, sent-link exclusion, Korean summary/translation, Telegram send, and sent-store update only after success.

### Task 4: Verify

**Files:**
- Verify only

**Step 1: Run focused delivery tests**
- Run: `npm test -- src/delivery/deliverNews.test.ts`

**Step 2: Run full verification**
- Run: `npm run typecheck`
- Run: `npm run lint`
- Run: `npm run build`
- Run: `npm test`
