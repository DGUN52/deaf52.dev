import { defineCollection, z } from 'astro:content';

// 공통 frontmatter 스키마
const baseSchema = z.object({
  title: z.string(),
  description: z.string(),
  lang: z.enum(['ko', 'en']),
  // 같은 글의 다른 언어 버전을 연결하는 키 (예: "docker-internals")
  // 이 값이 같으면 언어 선택 UI에서 서로 연결됨
  translationKey: z.string(),
  publishedAt: z.coerce.date(),
  updatedAt: z.coerce.date().optional(),
  draft: z.boolean().default(false),
  heroImage: z.string().optional(),
});

// 대분류: IT기술 -> 소분류는 자유 태그 (Docker, DB, 알고리즘 등)
const itCollection = defineCollection({
  type: 'content',
  schema: baseSchema.extend({
    category: z.literal('it'),
    tech: z.array(z.string()), // 예: ["Docker", "MongoDB", "Kubernetes"]
  }),
});

// 대분류: 인문학 -> 소분류는 고정 enum (리뷰/사색/픽션/논픽션)
const humanitiesCollection = defineCollection({
  type: 'content',
  schema: baseSchema.extend({
    category: z.literal('humanities'),
    subcategory: z.enum(['review', 'reflection', 'fiction', 'nonfiction']),
  }),
});

export const collections = {
  it: itCollection,
  humanities: humanitiesCollection,
};
