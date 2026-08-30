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

같은 글의 다른 언어 버전은 frontmatter의 `translationKey` 값을 동일하게 맞추면 서로 연결됩니다 (`src/i18n/utils.ts`의 `getTranslations()`). 헤더의 국기 박스(`HeaderLangSwitcher`)로 언어를 전환할 수 있습니다. `translationKey`가 같아도 언어별로 파일명(slug)은 달라도 되며, 상세 페이지에서 언어 전환 시 각 언어의 실제 slug로 정확히 이동합니다(`slugOverrides`).

`LOCALES`의 값(`il`, `in`, `tw`, `uk`)은 이 프로젝트 내부에서만 쓰는 라우팅/폴더명 코드이고, 검색엔진에 노출되는 `hreflang`·`<html lang>`에는 `src/i18n/utils.ts`의 `LOCALE_HREFLANG` 매핑을 거쳐 표준 언어 코드(`he`, `hi`, `zh-Hant`, `en-GB`)로 변환해서 내보냅니다. 자세한 이유는 해당 파일의 주석 참고.

## 카테고리 구조

- **IT기술** (`it`): 자유 태그(`tech: []`), 카테고리 페이지에서 "최신순" 기본 보기, 기술별 그룹 보기 지원
- **인문학** (`humanities`): 고정 소분류(`subcategory: review | reflection | fiction | nonfiction`), 카테고리 페이지에서 "소분류별" 기본 보기, 최신순 보기 지원

## 로컬 실행

```bash
npm install
npm run dev
```

콘텐츠 레포의 글을 로컬에서 보려면 `src/content/it/`, `src/content/humanities/` 안에 content 레포의 `it/`, `humanities/` 폴더 내용을 복사해 넣어야 합니다 (배포 시엔 빌드 스크립트가 자동으로 처리).

`npm run build`는 Astro 정적 빌드 후 [Pagefind](https://pagefind.app)로 검색 인덱스까지 함께 생성합니다.

## 배포 (Cloudflare)

이 프로젝트는 Cloudflare Workers(정적 assets + API)로 배포됩니다.

- **Build command**:
  ```
  git clone https://x-access-token:$CONTENT_REPO_TOKEN@github.com/DGUN52/deaf52.dev-content.git tmp-content && cp -r tmp-content/it src/content/it && cp -r tmp-content/humanities src/content/humanities && npm run build
  ```
  (`CONTENT_REPO_TOKEN`은 Cloudflare Pages 설정의 Secret 환경변수로 등록된 GitHub Fine-grained token, content 레포에 대한 Contents: Read-only 권한)
- **Deploy command**: `npx wrangler deploy`
- `wrangler.jsonc`에 정적 파일(`dist/`)을 Worker의 assets로 서빙하도록 설정되어 있고, 방문자/글별 카운터 및 아래 API들(`worker/index.js`)이 같이 배포됩니다.

## 사이트 기능

- **검색**: Pagefind 기반 정적 검색(`SearchBox.astro`). 언어별로 별도 인덱싱됨.
- **좋아요**: 글마다 좋아요 버튼. 클라이언트가 `localStorage`로 "내가 눌렀는지"를 기억하고, 그 상태에 따라 서버 카운트를 +1/-1 요청하는 단순한 방식(로그인 시스템 없음, 새로고침 연타 어뷰징은 클라이언트 신뢰에 의존).
- **인기글 사이드바**: 조회수 기준 상위 글을 글 상세 페이지에 노출(`PopularSidebar.astro`, `/api/ranking`).
- **번역 신고**: 독자가 번역 품질 문제를 신고할 수 있는 위젯(`TranslationReport.astro`). 신고 내용은 KV에 저장되고, `/ko/admin/reports` 관리자 페이지에서 조회·처리완료 처리 가능(Cloudflare Access로 접근 보호 필요, 아래 참고).
- **RSS**: 언어별 피드(`/{lang}/rss.xml`).
- **쿠키 동의 배너(CMP)**: `CookieConsentBanner.astro`. Cloudflare Worker가 `request.cf.country`로 방문자 국가를 감지해 `<head>`에 주입하고, EEA·영국·스위스 방문자에게는 기본값을 "거부"로, 그 외 지역은 "허용"으로 설정하는 Google Consent Mode를 구현. 현재는 `analytics_storage`만 배너에서 실제로 갱신되며, 광고 관련 동의(`ad_storage` 등)는 광고 도입 시점에 확장 예정.
- **GA4 / GTM**: Google Tag Manager(`GTM-TFW86BDB`) 경유로 GA4(`G-7YH0P1N5VR`) 연동. Ko-fi 클릭, 글 좋아요, 번역 신고 제출에 커스텀 이벤트(dataLayer push) 연결.
- **개인정보처리방침**: `/{lang}/privacy/` — 9개 언어. Google AdSense 신청의 선행 요건으로 작성됨.
- **hreflang**: 모든 페이지 `<head>`에 언어별 alternate 링크 + `x-default` 자동 생성(`BaseLayout.astro`). 글 상세 페이지는 실제로 번역이 존재하는 언어만 상호참조하도록 동적으로 계산됨.
- **sitemap**: `@astrojs/sitemap` 사용, 404·루트 리다이렉트 페이지는 제외.

## 방문자 카운터 및 API

Cloudflare KV(`COUNTERS` 네임스페이스)를 이용해 방문자 수, 글별 조회수·좋아요, 번역 신고를 기록합니다. 전체 API 목록(`worker/index.js`):

- `GET  /api/counter/site` — 사이트 전체 카운트 +1 하고 현재 값 반환
- `GET  /api/counter/post?slug=xxx` — 해당 글 조회수 +1 하고 현재 값 반환
- `GET  /api/like/post?slug=xxx` — 해당 글 좋아요 수 조회(증감 없음)
- `POST /api/like/post?slug=xxx` — 해당 글 좋아요 토글(body: `{ liked: boolean }`)
- `POST /api/report/translation` — 번역 신고 접수(body: `{ slug, lang, issueType, section?, comment? }`)
- `GET  /api/ranking?metric=views|likes&limit=5` — 조회수/좋아요 상위 글 목록
- `GET  /api/admin/reports` — 번역 신고 전체 목록(최신순)
- `PATCH /api/admin/reports?key=xxx` — 신고 처리 상태 토글(body: `{ status: 'open' | 'resolved' }`)

`/api/admin/*`는 애플리케이션 자체에 인증 로직이 없습니다. `/ko/admin/*` 경로를 Cloudflare Access(Zero Trust)로 이메일 인증 보호하는 것을 전제로 하며, 아직 이 Cloudflare 대시보드 설정이 안 되어 있다면 관리자 페이지 URL을 아는 누구나 접근할 수 있는 상태이니 주의.

## 콘텐츠 작업 도구

- **벨로그 마이그레이션**: 벨로그 GraphQL API로 글을 긁어와 마크다운으로 변환하는 스크립트 (별도 관리)
- **자동 번역**: `translate/translate.mjs` — Gemini API로 한국어 글을 8개 언어로 자동 번역해 content 레포에 채워 넣음. 사용법은 `translate/README.md` 참고.
- **번역 slug 정리**: `check-translation-keys.js` — 언어별 파일명이 한국어 기준과 어긋나는 경우(키 불일치, 파일명 다름, 고아 파일, 중복) 점검. `rename-slugs-to-match-ko.js` — 점검된 결과를 한국어 slug 기준으로 일괄 리네이밍(기본 dry-run, `--apply`로 실행). 둘 다 content 레포에서 사용.

## 다음 단계 후보

- 인문학 카테고리 콘텐츠 채우기
- Cloudflare Access로 `/ko/admin/*` 보호 설정
- 실제 트래픽 확보 후 CMP를 광고 동의(`ad_*`) 신호까지 확장하고 Google AdSense 신청
- www → non-www 리다이렉트, 국내 후원 수단(카카오페이/토스) 추가, 언어 자동 감지
- 댓글: [giscus](https://giscus.app) — GitHub Discussions 기반, 무료
