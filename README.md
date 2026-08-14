# deaf52.dev — DB와 인문학

## 구조

```
src/content/
  it/            # 대분류: IT기술
    ko/*.md
    en/*.md
  humanities/    # 대분류: 인문학
    ko/*.md
    en/*.md
```

- 같은 글의 다른 언어 버전은 frontmatter의 `translationKey` 값을 동일하게 맞추면
  `LanguageSwitcher` 컴포넌트가 자동으로 연결합니다.
- 번역이 아직 없는 언어는 "준비중"으로 표시되고 링크가 비활성화됩니다 (MongoDB 공식문서 방식과 동일).

## 로컬 실행

```bash
npm install
npm run dev
```

## Cloudflare Pages 배포

1. GitHub에 이 프로젝트 push
2. Cloudflare 대시보드 → Workers & Pages → Create → Pages → Connect to Git
3. Build command: `npm run build`, Output directory: `dist`
4. 배포 완료 후 Custom domains 탭에서 `deaf52.dev` 연결
   (이미 Cloudflare에서 도메인을 구매했으므로 DNS가 같은 계정 안에 있어 CNAME이 자동으로 붙습니다)

## 벨로그 마이그레이션 체크리스트

- [ ] 벨로그 글 목록/본문을 GraphQL API로 긁어서 마크다운으로 변환 (스크립트 필요)
- [ ] 각 글을 `it/ko/` 또는 `humanities/ko/`로 분류하며 frontmatter 채우기
- [ ] 벨로그 CDN 이미지 다운로드 → `public/images/`로 이전 후 경로 치환
  (벨로그 서비스가 바뀌거나 종료되면 이미지가 깨지는 것을 방지)
- [ ] 예전 벨로그 글 URL → 새 도메인 글 URL 301 리다이렉트 매핑 작성
  (SEO 순위 보존용, Cloudflare Pages `_redirects` 파일에 규칙 추가)

## 다음 단계 (선택)

- 검색: [Pagefind](https://pagefind.app) — 정적 사이트용, 다국어 지원
- 댓글: [giscus](https://giscus.app) — GitHub Discussions 기반, 무료
- RSS: `@astrojs/rss` 로 언어별 피드 분리 생성 권장
