// 이 사이트를 포크해서 자기 사이트로 바꿔 쓰려면 이 파일 하나만 고치면 된다.
//
// 예전엔 도메인/GA4/GTM/이메일/ko-fi/GitHub 저장소명이 BaseLayout.astro,
// astro.config.mjs, worker/index.js 등 여러 파일에 각각 하드코딩되어 있어서,
// 포크한 사람이 코드 전체를 grep해가며 값을 찾아 고쳐야 했다. 이 파일로 한 곳에
// 모아서, "내 사이트로 바꾸기"가 이 파일 수정 + wrangler.jsonc의 KV 네임스페이스 ID /
// Secrets(GITHUB_READ_TOKEN, CONTENT_REPO_TOKEN) 재설정만으로 끝나게 했다.
//
// 주의: Cloudflare Worker(worker/index.js)는 Astro 빌드와 별개의 런타임이라
// 이 파일을 직접 import할 수 없다. Worker가 필요로 하는 값(현재는 GitHub 콘텐츠
// 저장소 이름)은 wrangler.jsonc의 vars.CONTENT_REPO로 별도 전달한다 - 값을 바꿀
// 땐 이 파일과 wrangler.jsonc 양쪽을 함께 맞춰야 한다(아래 CONTENT_REPO 주석 참고).

export const siteConfig = {
  /** 사이트 이름. 헤더 타이틀, <title> 접미사, OpenGraph site_name 등에 쓰인다. */
  siteName: 'deaf52',

  /** 헤더 부제목. */
  siteSubtitle: 'IT & humanities',

  /**
   * 배포 도메인 (프로토콜 포함, 끝에 슬래시 없이).
   * astro.config.mjs의 `site` 값과 반드시 동일해야 한다 (sitemap·canonical URL 생성에 사용).
   */
  siteUrl: 'https://deaf52.dev',

  /** 푸터 저작권에 쓰이는 연도. 매년 손으로 바꾸기보다, 필요하면 new Date().getFullYear()로 대체해도 된다. */
  copyrightYear: 2026,

  /** 관리자 연락처 이메일. 푸터 mailto 링크에 쓰인다. */
  contactEmail: 'deaf525252@gmail.com',

  /** 후원 링크. 없으면 빈 문자열로 두면 BaseLayout이 후원 링크 자체를 렌더링하지 않는다. */
  kofiUrl: 'https://ko-fi.com/B1L125QQRV',

  /** Google Tag Manager 컨테이너 ID. 안 쓰면 빈 문자열로 두면 GTM 관련 스크립트가 전부 스킵된다. */
  gtmId: 'GTM-TFW86BDB',

  /**
   * 콘텐츠(글) 저장소. GitHub 기준 "owner/repo" 형식.
   * README의 Build command(git clone 대상)와 wrangler.jsonc의 vars.CONTENT_REPO 양쪽에
   * 동일한 값을 넣어야 한다 - Worker는 이 파일을 import할 수 없어 별도로 전달받기 때문.
   */
  contentRepo: 'DGUN52/deaf52.dev-content',
} as const;
