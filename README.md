# deaf52.dev — deaf52 · IT & humanities

## 프로젝트 구조

이 사이트는 두 개의 저장소로 나뉘어 있습니다.

- **`main`** (이 레포): Astro 코드, 레이아웃, 컴포넌트, Cloudflare Worker — Public
- **`content`**: 실제 글 콘텐츠(`it/`, `humanities/`) — Private, 빌드 시점에 clone되어 합쳐짐

```
content 레포/
  it/
    ko/*.md   en/*.md   ja/*.md   ...
  humanities/
    ko/*.md   en/*.md   ja/*.md   ...
```

## 지원 언어

`ko`(기본), `en`, `ja`, `zh`, `in`, `de`, `uk`, `il`, `tw` — 총 9개 언어.
언어 목록은 `src/i18n/utils.ts`의 `LOCALES` 배열 하나로 관리되며, `astro.config.mjs`의 `i18n.locales`와 `src/content/config.ts`의 `lang` enum도 동일하게 맞춰야 합니다.

같은 글의 다른 언어 버전은 frontmatter의 `translationKey` 값을 동일하게 맞추면 서로 연결됩니다 (`src/i18n/utils.ts`의 `getTranslations()`). 헤더의 국기 박스(`HeaderLangSwitcher`)로 언어를 전환할 수 있습니다.

## 카테고리 구조

- **IT기술** (`it`): 자유 태그(`tech: []`), 카테고리 페이지에서 "최신순" 기본 보기, 기술별 그룹 보기 지원
- **인문학** (`humanities`): 고정 소분류(`subcategory: review | reflection | fiction | nonfiction`), 카테고리 페이지에서 "소분류별" 기본 보기, 최신순 보기 지원

## 로컬 실행

```bash
npm install
npm run dev
```

콘텐츠 레포의 글을 로컬에서 보려면 `src/content/it/`, `src/content/humanities/` 안에 content 레포의 `it/`, `humanities/` 폴더 내용을 복사해 넣어야 합니다 (배포 시엔 빌드 스크립트가 자동으로 처리).

## 배포 (Cloudflare)

이 프로젝트는 Cloudflare Workers(정적 assets + API)로 배포됩니다.

- **Build command**:
  ```
  git clone https://x-access-token:$CONTENT_REPO_TOKEN@github.com/DGUN52/deaf52.dev-content.git tmp-content && cp -r tmp-content/it src/content/it && cp -r tmp-content/humanities src/content/humanities && npm run build
  ```
  (`CONTENT_REPO_TOKEN`은 Cloudflare Pages 설정의 Secret 환경변수로 등록된 GitHub Fine-grained token, content 레포에 대한 Contents: Read-only 권한)
- **Deploy command**: `npx wrangler deploy`
- `wrangler.jsonc`에 정적 파일(`dist/`)을 Worker의 assets로 서빙하도록 설정되어 있고, 방문자/글별 카운터 API(`worker/index.js`)가 같이 배포됩니다.

## 방문자 카운터

Cloudflare KV(`COUNTERS` 네임스페이스)를 이용해 사이트 전체 방문자 수와 글별 조회수를 기록합니다.

- `GET /api/counter/site` — 사이트 전체 카운트 +1
- `GET /api/counter/post?slug=xxx` — 해당 글 카운트 +1

## 콘텐츠 작업 도구

- **벨로그 마이그레이션**: 벨로그 GraphQL API로 글을 긁어와 마크다운으로 변환하는 스크립트 (별도 관리)
- **자동 번역**: `translate/translate.mjs` — Gemini API로 한국어 글을 8개 언어로 자동 번역해 content 레포에 채워 넣음. 사용법은 `translate/README.md` 참고.

## 다음 단계 후보

- 검색: [Pagefind](https://pagefind.app) — 정적 사이트용, 다국어 지원
- 댓글: [giscus](https://giscus.app) — GitHub Discussions 기반, 무료
- sitemap: 한 차례 빌드 에러로 제거됨 — 재도입 시 원인 파악 필요