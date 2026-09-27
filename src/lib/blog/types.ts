/**
 * The blog's content model.
 *
 * Posts are typed data, not MDX: the whole point of these pages is search
 * traffic, and a fixed shape is what lets every post emit the same complete
 * Article and FAQPage markup without an author remembering to add it. It also
 * keeps the dependency list where it is - no compiler, no front-matter parser.
 */

export type Block =
  | { kind: "p"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "steps"; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] }
  /** A single sentence worth pulling out of the flow. Google likes to lift these. */
  | { kind: "note"; text: string };

export type Section = {
  /** Rendered as <h2>. Phrase it the way the question is typed into Google. */
  heading: string;
  blocks: Block[];
};

/** Feeds both the on-page accordion and the FAQPage structured data. */
export type Faq = { q: string; a: string };

export type Post = {
  slug: string;
  /** <h1>. May be longer and warmer than the <title>. */
  title: string;
  /** <title>. Keep under ~60 characters or Google rewrites it. */
  metaTitle: string;
  /** Meta description. ~155 characters, written as a promise, not a summary. */
  description: string;
  /** The intent this page is meant to win. Not emitted as a meta tag - those
   *  have been ignored for years - but it keeps the set honest about overlap. */
  keywords: string[];
  /** ISO dates. `updated` drives the sitemap's lastModified. */
  published: string;
  updated: string;
  readingMinutes: number;
  /** Shown on the index card and used as the opening paragraph. */
  excerpt: string;
  sections: Section[];
  faq: Faq[];
  /** Slugs of sibling posts. Internal links are the only ranking factor we
   *  control completely, so every post points at two others. */
  related: string[];
};
