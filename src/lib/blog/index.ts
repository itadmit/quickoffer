import { post as eichKotvim } from "./posts/eich-kotvim-hatzaat-mechir";
import { post as tavnit } from "./posts/tavnit-hatzaat-mechir";
import { post as baaleiMiktzoa } from "./posts/hatzaat-mechir-baalei-miktzoa";
import { post as maam } from "./posts/maam-tokef-tnaei-tashlum";
import { post as mulHeshbonit } from "./posts/hatzaat-mechir-mul-heshbonit";
import type { Post } from "./types";

export type { Post, Section, Block, Faq } from "./types";

/**
 * Newest first. The pillar sits first on purpose: it is the page the other four
 * link back to, and the one a visitor should land on if they read only one.
 */
export const POSTS: readonly Post[] = [
  eichKotvim,
  tavnit,
  baaleiMiktzoa,
  maam,
  mulHeshbonit,
];

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug);
}

/** Resolves a post's `related` slugs, dropping any that no longer exist. */
export function relatedPosts(post: Post): Post[] {
  return post.related.map(getPost).filter((p): p is Post => Boolean(p));
}
