import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { quoteTemplates, type QuoteTemplate, type User } from "@/lib/db/schema";
import { DEFAULT_TEMPLATE, normalizeTemplateSpec, type QuoteTemplateSpec } from "./template-spec";

export function specOf(t: Pick<QuoteTemplate, "layout" | "accent" | "footerText"> | null | undefined): QuoteTemplateSpec {
  return t ? normalizeTemplateSpec(t) : DEFAULT_TEMPLATE;
}

export async function listTemplates(opts: { enabledOnly?: boolean } = {}): Promise<QuoteTemplate[]> {
  const rows = await db.select().from(quoteTemplates).orderBy(asc(quoteTemplates.sortOrder), asc(quoteTemplates.createdAt));
  return opts.enabledOnly ? rows.filter((r) => r.enabled) : rows;
}

export async function getTemplate(id: string): Promise<QuoteTemplate | null> {
  const row = await db.query.quoteTemplates.findFirst({ where: eq(quoteTemplates.id, id) });
  return row ?? null;
}

export async function getDefaultTemplate(): Promise<QuoteTemplate | null> {
  const rows = await listTemplates({ enabledOnly: true });
  return rows.find((r) => r.isDefault) ?? rows[0] ?? null;
}

/** The user's chosen template if it is still enabled, else the default. */
export async function getTemplateForUser(user: Pick<User, "templateId">): Promise<QuoteTemplateSpec> {
  if (user.templateId) {
    const t = await getTemplate(user.templateId);
    if (t?.enabled) return specOf(t);
  }
  return specOf(await getDefaultTemplate());
}
