import { z } from "zod";
import { BlogPostStatus } from "../constants";

export const createBlogPostSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z.string().min(1).max(255),
  categoryId: z.string().uuid(),
  excerpt: z.string().max(500).optional(),
  body: z.string().min(1),
  coverImageUrl: z.string().url().max(512).optional(),
  tags: z.array(z.string()).optional(),
  status: z.nativeEnum(BlogPostStatus).optional().default(BlogPostStatus.DRAFT),
});

export const updateBlogPostSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  slug: z.string().min(1).max(255).optional(),
  categoryId: z.string().uuid().optional(),
  excerpt: z.string().max(500).optional(),
  body: z.string().min(1).optional(),
  coverImageUrl: z.string().url().max(512).optional().nullable(),
  tags: z.array(z.string()).optional(),
  status: z.nativeEnum(BlogPostStatus).optional(),
});

export const createBlogCategorySchema = z.object({
  name: z.string().min(1).max(64),
  slug: z.string().min(1).max(64),
  description: z.string().max(255).optional(),
});

export type CreateBlogPostInput = z.infer<typeof createBlogPostSchema>;
export type UpdateBlogPostInput = z.infer<typeof updateBlogPostSchema>;
export type CreateBlogCategoryInput = z.infer<typeof createBlogCategorySchema>;
