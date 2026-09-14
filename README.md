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

## 포크해서 쓰기

사이트 이름·도메인·연락처·후원 링크·GA4/GTM ID·콘텐츠 저장소 이름처럼 "이 계정 고유"의 값은 전부 `src/site.config.ts` 한 파일에 모여 있습니다. 포크한 뒤 이 파일만 자신의 값으로 바꾸면 헤더/푸터/메타태그/SEO 문구/GTM 스크립트 전체에 자동으로 반영됩니다(GTM을 안 쓸 경우 `gtmId`를 빈 문자열로 두면 관련 스크립트 전체가 스킵됨, ko-fi도 `kofiUrl`을 빈 문자열로 두면 후원 버튼이 아예 렌더링되지 않음).

단, `worker/index.js`(Cloudflare Worker)는 Astro 빌드와 별개 런타임이라 `.ts` 설정 모듈을 직접 import할 수 없습니다. 그래서 Worker가 필요로 하는 콘텐츠 저장소 이름은 `wrangler.jsonc`의 `vars.CONTENT_REPO`로 따로 전달하며, 포크 시 이 값을 `site.config.ts`의 `contentRepo`와 동일하게 맞춰줘야 합니다.

각 페이지의 다국어 SEO title/description 문구(홈/`/it/`/`/humanities/` 목록 페이지)도 사이트 이름이 들어가는 자리는 `siteConfig.siteName`을 함수로 끼워넣는 구조라, 사이트 이름을 바꾸면 9개 언어 전부 자동으로 반영됩니다.

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

콘텐츠 레포의 글/이미지를 로컬에서 보려면 `src/content/it/`, `src/content/humanities/`, `public/images/` 안에 content 레포의 `it/`, `humanities/`, `public/images/` 폴더 내용을 복사해 넣어야 합니다 (배포 시엔 아래 Build command가 자동으로 처리).

`npm run build`는 Astro 정적 빌드 후 [Pagefind](https://pagefind.app)로 검색 인덱스까지 함께 생성합니다.

## 배포 (Cloudflare)

이 프로젝트는 Cloudflare Workers(정적 assets + API)로 배포됩니다.

- **Build command**:
  ```
  git clone https://x-access-token:$CONTENT_REPO_TOKEN@github.com/DGUN52/deaf52.dev-content.git tmp-content && rm -rf src/content/it src/content/humanities public/images && cp -r tmp-content/it src/content/it && cp -r tmp-content/humanities src/content/humanities && mkdir -p public/images && cp -r tmp-content/public/images/. public/images/ && npm run build
  ```
  (`CONTENT_REPO_TOKEN`은 Cloudflare Pages 설정의 Secret 환경변수로 등록된 GitHub Fine-grained token, content 레포에 대한 Contents: Read-only 권한. 포크 시 이 명령어의 저장소 경로도 `src/site.config.ts`의 `contentRepo`와 동일한 값으로 바꿔야 함)

  매 배포마다 `src/content/it`, `src/content/humanities`, `public/images`를 완전히 지우고 content 레포의 최신 상태(글 텍스트 + `public/images/`에 있는 원본 이미지, 그리고 아래에서 설명하는 `public/images/responsive/`·`responsive-manifest.json`)로 통째로 교체한 뒤 빌드합니다. 즉 로컬 `main` 레포의 `public/images`에 무엇이 남아있든 프로덕션 빌드와는 무관하며, 이미지 관련 상태는 항상 content 레포가 유일한 원본(source of truth)입니다.

  **반응형 이미지(srcset)는 빌드 시점이 아니라 content 레포에 미리 생성해 커밋해 둡니다.** `utility/responsive_image_maker/generate_responsive_images.py`(content 레포)가 `public/images/`의 각 WebP 원본마다 400px/800px/1600px variant를 `public/images/responsive/`에 만들고 `public/images/responsive-manifest.json`에 기록합니다. 이미 처리된 원본은 재실행 시 건너뛰므로, 새 글을 쓰거나 이미지를 추가/교체했을 때만 다시 실행해서 늘어난 만큼만 커밋하면 됩니다(매 배포마다 전체를 다시 리사이즈하지 않음 — git alias로 쉽게 실행하는 방법은 아래 "콘텐츠 작업 도구" 참고). main 레포의 remark 플러그인(`src/remark-responsive-images.mjs`)이 이 매니페스트를 읽어 마크다운 이미지를 srcset 있는 `<img>`로 바꿔주고, 매니페스트에 없는 이미지는 기존 방식(단순 `<img>`)으로 자동 폴백됩니다.
- **Deploy command**: `npx wrangler deploy`
- `wrangler.jsonc`에 정적 파일(`dist/`)을 Worker의 assets로 서빙하도록 설정되어 있고, 방문자/글별 카운터 및 아래 API들(`worker/index.js`)이 같이 배포됩니다.

## 사이트 기능

- **홈페이지 글 목록**: IT기술·인문학 각 최신 5개만 노출(`[lang]/index.astro`, `.slice(0, 5)`). 왼쪽 칼럼은 일련번호 대신 발행일(`formatDateShort`, `src/i18n/formatDate.ts`) — 다국어 환경에서 숫자만으로 월/일 순서가 헷갈리지 않도록 항상 영문 월 약어(Jan~Dec) 사용, 올해 글은 "Sep 10"(월 일), 작년 이전 글은 "2025 Sep"(연도가 먼저 오는 순서로 오래된 글임을 한눈에 표시). `/it/`, `/humanities/` 카테고리 전체 목록 페이지도 동일한 날짜 표시 적용(전체 글 수는 그대로 다 보여줌, 5개 제한은 홈페이지 한정). 섹션 제목(IT기술/인문학) 앞의 "01"/"02" 같은 일련번호 마커는 홈페이지와 `/it/`, `/humanities/` 목록 페이지 모두에서 제거됨.
- **목차(TOC)**: `TocSidebar.astro`가 글의 모든 헤딩 깊이(h2 이하 전부)를 표시(예전엔 depth 1~2만 표시). 목차 링크에는 밑줄 없음.
- **RTL(오른쪽에서 왼쪽) 지원**: `src/i18n/utils.ts`의 `LOCALE_DIR` 매핑에 따라 `<html dir>` 속성이 언어별로 자동 설정됨(`il`만 `rtl`, 나머지는 `ltr`). 코드블록·인라인 코드는 RTL 페이지에서도 항상 LTR로 고정(`direction: ltr; unicode-bidi: embed;`).
- **인라인 코드 스타일**: 배경/글자색은 사이트 팔레트의 `--human`/`--human-soft`(버건디 계열) 사용 — 사이트 배경(따뜻한 종이색)과 색온도는 맞으면서, 배경 대비는 뚜렷하게 유지해 가독성 확보.
- **표 좌측 제목열**: 마크다운 GFM 테이블은 첫 "행"만 `<th>`로 렌더링하고 첫 "열"을 제목열로 만드는 문법이 없어서, 좌측 열로 만들고 싶은 셀을 `**볼드**`로 작성하면 CSS(`td:first-child:has(> strong:only-child)`)가 실제 `<th>`와 동일한 배경/폰트를 입혀 시각적으로 제목열처럼 보이게 함. `/ko/admin/editor`의 미리보기에도 동일 규칙 적용.
- **검색**: Pagefind 기반 정적 검색(`SearchBox.astro`). 언어별로 별도 인덱싱됨.
- **좋아요**: 글마다 좋아요 버튼. 클라이언트가 `localStorage`로 "내가 눌렀는지"를 기억하고, 그 상태에 따라 서버 카운트를 +1/-1 요청하는 단순한 방식(로그인 시스템 없음, 새로고침 연타 어뷰징은 클라이언트 신뢰에 의존).
- **인기글 사이드바**: 조회수 기준 상위 글을 글 상세 페이지에 노출(`PopularSidebar.astro`, `/api/ranking`).
- **번역 신고**: 독자가 번역 품질 문제를 신고할 수 있는 위젯(`TranslationReport.astro`). 신고 내용은 KV에 저장되고, `/ko/admin/reports` 관리자 페이지에서 조회·처리완료 처리 가능(Cloudflare Access로 접근 보호 필요, 아래 참고).
- **글 에디터**: `/ko/admin/editor` — 마크다운 글 작성/수정용 관리자 전용 페이지(`src/pages/ko/admin/editor.astro`, Cloudflare Access 보호 전제). GitHub API로 content 레포의 기존 글을 읽어와 폼에 채우고, 완성된 글은 frontmatter+본문을 합쳐 `.md` 파일로 다운로드하는 방식(직접 커밋 권한은 없음 — 다운로드 후 수동으로 content 레포에 넣고 git commit/push). 주요 기능:
  - 본문 서식 툴바(굵게/기울임/밑줄/취소선/링크/이미지) + 단축키(Ctrl+B/I/U, Ctrl+Shift+S)
  - 우측에 실시간 마크다운 미리보기(사이트 실제 글 페이지와 동일한 타이포그래피 적용)
  - 기존 작성 중이던 `.md` 파일을 에디터에 드래그앤드롭하면 폼 전체 자동 채움("새 글 작성" 상태일 때만 동작)
  - 이미지 미리보기: 파일 선택창으로 로컬 이미지를 고르면 그 파일이 브라우저 메모리에서 임시 미리보기로 뜨고, `public/images` 폴더 자체를 연결(File System Access API, Chrome/Edge)해두면 본문에 쓰인 이미지 파일명을 폴더에서 자동으로 찾아 보여줌 — 배포 사이트에 아직 없는 새 이미지도 로컬에서 미리 확인 가능. 실제 업로드는 없음(순수 미리보기용)
  - 기술 태그 체크박스 목록(IT 카테고리, 기존 글들에서 자동 수집·캐싱), heroImage/본문 이미지 select 드롭다운(`public/images/` 목록 fetch)
  - 입력 내용은 `localStorage`에 디바운스 자동저장(임시 초안), 브라우저 새로고침해도 복구 가능
  - 본문 편집창과 미리보기는 각각 독립적으로 스크롤됨(화면 높이 기준 고정 높이, 한쪽을 스크롤해도 다른 쪽에 영향 없음)
- **RSS**: 언어별 피드(`/{lang}/rss.xml`).
- **쿠키 동의 배너(CMP)**: `CookieConsentBanner.astro`. Cloudflare Worker가 `request.cf.country`로 방문자 국가를 감지해 `<head>`에 주입하고, EEA·영국·스위스 방문자에게는 기본값을 "거부"로, 그 외 지역은 "허용"으로 설정하는 Google Consent Mode를 구현. 현재는 `analytics_storage`만 배너에서 실제로 갱신되며, 광고 관련 동의(`ad_storage` 등)는 광고 도입 시점에 확장 예정.
- **GA4 / GTM**: Google Tag Manager 경유로 GA4 연동(GTM ID는 `src/site.config.ts`의 `gtmId`, 빈 문자열이면 관련 스크립트 전체 스킵). Ko-fi 클릭, 글 좋아요, 번역 신고 제출에 커스텀 이벤트(dataLayer push) 연결.
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
- `GET  /api/editor/posts?category=xxx` — 해당 카테고리(ko 기준) 기존 글 slug 목록
- `GET  /api/editor/posts?category=xxx&slug=yyy` — 해당 글의 원본 마크다운(frontmatter 포함) 조회 — GitHub API로 content 레포에서 읽기 전용으로 가져옴
- `GET  /api/editor/images` — `public/images/` 폴더 목록(에디터의 이미지 select 채우기용)
- `GET  /api/editor/tags` — KV에 캐시된 기술 태그 목록
- `POST /api/editor/tags/refresh` — 기존 IT 글 전체를 훑어 기술 태그 목록을 새로 만들어 KV에 캐싱

`/api/admin/*`, `/api/editor/*`는 애플리케이션 자체에 인증 로직이 없습니다. `/ko/admin/*` 경로를 Cloudflare Access(Zero Trust)로 이메일 인증 보호하는 것을 전제로 하며, 아직 이 Cloudflare 대시보드 설정이 안 되어 있다면 관리자 페이지 URL을 아는 누구나 접근할 수 있는 상태이니 주의.

## 콘텐츠 작업 도구

- **벨로그 마이그레이션**: 벨로그 GraphQL API로 글을 긁어와 마크다운으로 변환하는 스크립트 (별도 관리)
- **자동 번역**: `translate/translate.mjs` — Gemini API로 한국어 글을 8개 언어로 자동 번역해 content 레포에 채워 넣음. 사용법은 `translate/README.md` 참고. (별도로, Claude 계정에 등록된 `deaf52-blog-translate` 스킬로도 개별 글을 지정해 8개 언어 번역을 수행할 수 있음 — 번역 대상 글은 항상 사용자가 직접 지정. 한국어(ko)가 아닌 7개 언어 버전에는 본문 최상단에 "이 글은 AI로 번역되었으며 원본은 한국어로 작성되었습니다" 고지문을 해당 언어로 자동 삽입.)
- **번역 slug 정리**: `check-translation-keys.js` — 언어별 파일명이 한국어 기준과 어긋나는 경우(키 불일치, 파일명 다름, 고아 파일, 중복) 점검. `rename-slugs-to-match-ko.js` — 점검된 결과를 한국어 slug 기준으로 일괄 리네이밍(기본 dry-run, `--apply`로 실행). 둘 다 content 레포에서 사용.
- **이미지 최적화 & 반응형 이미지(srcset) 생성**: `utility/responsive_image_maker/`(content 레포)에 있는 두 스크립트로 처리합니다.
  - `optimize_images.py` — PNG/JPG 원본을 WebP로 변환·리사이즈(긴 변 1600px 상한)하고 content 레포 전체 `.md`의 이미지 링크를 갱신.
  - `generate_responsive_images.py` — `public/images/`의 WebP 원본마다 400px/800px/1600px variant를 `public/images/responsive/`에 만들고 `public/images/responsive-manifest.json`에 기록. 이미 처리된 원본은 자동으로 건너뛰므로 늘어난 이미지만큼만 새로 생성됩니다.

  새 글을 쓰거나 이미지를 추가/교체했을 때, content 레포 루트에서 아래 git alias로 실행합니다(둘 다 `--apply` 전에 dry-run으로 먼저 확인 권장):
  ```bash
  git process-images-dry   # 두 스크립트를 순서대로 dry-run (미리보기)
  git process-images       # 실제 적용 (optimize_images.py --apply && generate_responsive_images.py --apply)

  # 반응형 variant만 다시 만들고 싶을 때 (예: PNG/JPG 변환은 필요 없고 srcset만 갱신)
  git responsive-images-dry
  git responsive-images

  git alias                # 등록된 git alias 이름 목록 확인
  ```
  이 alias들은 `.git/config`에 로컬로 등록되어 있어 컴퓨터마다 한 번씩 등록해야 합니다:
  ```bash
  git config alias.responsive-images '!python3 utility/responsive_image_maker/generate_responsive_images.py --images-dir public/images --apply'
  git config alias.responsive-images-dry '!python3 utility/responsive_image_maker/generate_responsive_images.py --images-dir public/images --dry-run'
  git config alias.process-images '!python3 utility/responsive_image_maker/optimize_images.py --images-dir public/images --content-dir . --apply && python3 utility/responsive_image_maker/generate_responsive_images.py --images-dir public/images --apply'
  git config alias.process-images-dry '!python3 utility/responsive_image_maker/optimize_images.py --images-dir public/images --content-dir . --dry-run && echo --- && python3 utility/responsive_image_maker/generate_responsive_images.py --images-dir public/images --dry-run'
  git config alias.alias '!git config --get-regexp "^alias\." | sed "s/^alias\.//" | cut -d" " -f1 | sort'
  ```
  실행 후 생긴 변경사항(`public/images/responsive/`, `responsive-manifest.json`, 그리고 `optimize_images.py`가 만든 신규 `.webp`/`images-backup-original/`)을 content 레포에 커밋/푸시하면, 다음 배포 시 Build command가 그대로 main 쪽 `public/images`에 복사해 가져갑니다(빌드 시점에 재생성하지 않음).

## 다음 단계 후보

- 인문학 카테고리 콘텐츠 채우기
- 실제 트래픽 확보 후 CMP를 광고 동의(`ad_*`) 신호까지 확장하고 Google AdSense 신청
- www → non-www 리다이렉트 (선택 정리 항목: canonical 태그로 SEO 중복은 이미 방지되고 있어 급하지 않음. 다만 `www.deaf52.dev`도 리다이렉트 없이 그대로 200으로 응답 중이라, Cloudflare에서 Redirect Rules로 non-www 하나로 통일해두면 링크 공유·캐시 정책 관리가 깔끔해짐)
- 국내 후원 수단(카카오페이/토스) 추가 — 도입 검토 중
- 댓글: [giscus](https://giscus.app) — GitHub Discussions 기반, 무료

**보류/비채택으로 결정한 항목**
- 언어 자동 감지(브라우저 Accept-Language 기반 리다이렉트) — SEO에 악영향 줄 수 있다고 판단해 도입하지 않기로 함 (검색엔진 크롤러가 언어별 URL을 각각 색인하지 못하고 리다이렉트만 타게 될 위험)
