import type { BlogPostStatus } from "../constants";

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
}

export interface BlogPost {
  id: string;
  categoryId: string;
  authorId: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  coverImageUrl: string | null;
  status: BlogPostStatus;
  publishedAt: string | null;
  tags: string[] | null;
  createdAt: string;
  updatedAt: string;
}
