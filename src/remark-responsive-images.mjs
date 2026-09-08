// src/remark-responsive-images.mjs
//
// 마크다운의 이미지(`![alt](/images/foo.webp)`)를 srcset 있는 <img>로 바꿔주는
// remark 플러그인. generate_responsive_images.py가 빌드 전에 만들어둔
// public/images/responsive-manifest.json을 읽어서, 실제로 여러 폭이 준비된
// 이미지만 srcset을 붙이고, 매니페스트에 없는 이미지(리소스 스크립트를 아직
// 안 돌렸거나 대상이 아닌 이미지)는 원래 그대로의 단일 <img>로 둔다 - 안전한 폴백.
//
// PageSpeed Insights가 지적한 "표시 크기보다 원본이 너무 크다" 문제 해결:
// 브라우저가 sizes 힌트와 자기 화면 폭을 보고 srcset 중 적당한 후보를 골라
// 받으므로, 모바일에서는 작은 파일을, 데스크톱에서는 큰 파일을 받는다.
// 모든 크기는 빌드 시점에 이미 파일로 존재하므로 요청 시점 서버 처리는 없다
// (정적 파일 서빙 그대로) - Cloudflare Workers CPU 시간에 영향 없음.
//
// astro.config.mjs에서 markdown.remarkPlugins에 등록해서 사용한다:
//   import responsiveImages from './src/remark-responsive-images.mjs';
//   markdown: { remarkPlugins: [responsiveImages] }

import { visit } from 'unist-util-visit';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const manifestPath = path.resolve(__dirname, '../public/images/responsive-manifest.json');

let manifest = {};
if (existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch {
    // 매니페스트가 깨져 있어도 빌드 자체는 막지 않는다 - 그냥 반응형 적용 없이 진행.
    manifest = {};
  }
} else {
  // 매니페스트가 없으면(스크립트를 아직 안 돌렸으면) 전부 폴백 - 에러 아님.
  manifest = {};
}

/**
 * "/images/foo.webp" 같은 마크다운 이미지 경로에서 파일명만 뽑아 매니페스트에서 찾는다.
 * heroImage 등 frontmatter 쪽 이미지는 이 플러그인이 건드리지 않는다(본문 마크다운 이미지 전용).
 */
function findManifestEntry(src) {
  if (!src || !src.startsWith('/images/')) return null;
  const filename = src.slice('/images/'.length);
  return manifest[filename] ?? null;
}

export default function remarkResponsiveImages() {
  return (tree) => {
    visit(tree, 'image', (node, index, parent) => {
      if (!parent || index == null) return;

      const entry = findManifestEntry(node.url);
      const alt = node.alt ?? '';

      if (!entry) {
        // 매니페스트에 없음(스크립트 미실행 또는 대상 외 이미지) - 기존과 동일한 단순 <img>로 폴백.
        // remark-rehype가 image 노드를 알아서 <img>로 바꿔주므로 별도 처리 없이 그대로 둔다.
        return;
      }

      const { original, variants } = entry;
      // srcset: 작은 폭부터 큰 폭 순, 마지막은 원본(가장 큰 사이즈, 이미 WebP로 최적화된 원본).
      const srcsetParts = variants.map((v) => `/images/${v.file} ${v.width}w`);
      srcsetParts.push(`/images/${original.file} ${original.width}w`);
      const srcset = srcsetParts.join(', ');

      // 본문 컨테이너 최대 폭 760px 기준 sizes 힌트:
      // 화면이 760px보다 좁으면(대부분의 모바일) 화면 폭 그대로, 넓으면 760px로 고정.
      const sizes = '(max-width: 760px) 100vw, 760px';

      const html =
        `<img src="/images/${original.file}" srcset="${srcset}" sizes="${sizes}" ` +
        `alt="${escapeHtml(alt)}" loading="lazy" decoding="async" ` +
        `width="${original.width}" height="${original.height}" />`;

      parent.children[index] = { type: 'html', value: html };
    });
  };
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
