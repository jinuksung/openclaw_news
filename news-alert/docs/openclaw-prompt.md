# OpenClaw Prompt

아래 프롬프트를 OpenClaw에 그대로 넣어 사용한다.

```text
<repo>/news-alert 디렉토리에서 아래 작업을 순서대로 수행한다.

1. `dist/index.js`가 없거나 최신 코드가 반영되지 않았다면 `npm run build`를 실행한다.
2. `npm run archive-only`를 실행한다.
3. 오늘 날짜 기준 `data/articles/YYYY-MM-DD.jsonl` 파일을 읽는다.
4. `data/sent.json`에 이미 기록된 링크는 제외한다.
5. 남은 기사만 대상으로 한국어 1~3줄 요약을 만든다.
6. 영어 기사는 자연스러운 한국어로 번역해서 제목과 요약을 만든다.
7. 섹션별로 묶어서 텔레그램 메시지용 HTML 텍스트를 작성한다.
8. 텔레그램 전송을 수행한다.
9. 텔레그램 전송이 성공한 링크만 `data/sent.json`에 atomic write 방식으로 기록한다.
10. 실패한 링크는 `data/sent.json`에 기록하지 않는다.
11. 최종적으로 전송한 기사 수, 제외한 기사 수, 실패한 기사 수를 보고한다.

제약:
- 이미 `sent.json`에 있는 링크는 절대 다시 보내지 않는다.
- 기사 본문은 `data/articles/YYYY-MM-DD.jsonl`의 `content`만 사용한다.
- 텔레그램 전송 성공 전에는 `sent.json`을 수정하지 않는다.
- `data/sent.json` 저장은 기존 프로젝트의 정책과 동일하게 안전하게 처리한다.
- 출력 언어는 한국어로 한다.
```

## Notes

- `npm run archive-only`는 내부적으로 `SKIP_TELEGRAM=true`를 세팅하고 `dist/index.js`를 실행한다.
- 이 모드에서는 기사 아카이브만 저장하고 텔레그램 전송과 `sent.json` 갱신은 생략한다.
- `sent.json` 갱신 로직은 `src/store/sentStore.ts`를 참고하면 된다.
