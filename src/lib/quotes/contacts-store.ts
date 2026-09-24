import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { contacts, type Contact } from "../db/schema";
import { normalizePhone } from "../phone";
import { contactKey, isLearnableContact, type ContactEntry } from "./contacts";

/** DB side of the customer book. Matching logic is in ./contacts.ts. */

/** Enough to cover a working tradesperson's regulars without loading a CRM. */
const LOAD_LIMIT = 200;

/** The professional's customers, most recent first. */
export async function loadContacts(userId: string, limit = LOAD_LIMIT): Promise<ContactEntry[]> {
  return db
    .select({
      key: contacts.key,
      name: contacts.name,
      phone: contacts.phone,
      quoteCount: contacts.quoteCount,
    })
    .from(contacts)
    .where(eq(contacts.userId, userId))
    .orderBy(desc(contacts.lastQuoteAt))
    .limit(limit);
}

/** Full rows for the web screen, where the professional edits them. */
export async function listContacts(userId: string, limit = LOAD_LIMIT): Promise<Contact[]> {
  return db
    .select()
    .from(contacts)
    .where(eq(contacts.userId, userId))
    .orderBy(desc(contacts.lastQuoteAt))
    .limit(limit);
}

/**
 * Remember a customer from a quote.
 *
 * `bump` counts a real quote, and only quote creation passes it - the edit
 * screen autosaves every 800ms, and counting there would make one afternoon of
 * typing outrank a year of work, exactly as in the price book.
 *
 * A phone number never gets erased by a later quote that omits it: `coalesce`
 * keeps what we know. Learning must never lose information the professional
 * already gave us.
 */
export async function learnContact(
  userId: string,
  customer: { name: string | null; phone: string | null },
  { bump = false }: { bump?: boolean } = {},
): Promise<void> {
  if (!isLearnableContact(customer.name)) return;
  const key = contactKey(customer.name!);
  if (!key) return;
  const phone = normalizePhone(customer.phone) || null;

  try {
    await db
      .insert(contacts)
      .values({ userId, key, name: customer.name!.trim(), phone })
      .onConflictDoUpdate({
        target: [contacts.userId, contacts.key],
        set: {
          name: sql`excluded.name`,
          phone: sql`coalesce(excluded.phone, ${contacts.phone})`,
          quoteCount: bump ? sql`${contacts.quoteCount} + 1` : sql`${contacts.quoteCount}`,
          lastQuoteAt: new Date(),
        },
      });
  } catch (err) {
    // A customer book that fails must never cost the professional their quote.
    console.error("[contacts] learn failed", err);
  }
}

export async function updateContact(
  userId: string,
  id: string,
  values: { name?: string; phone?: string | null },
): Promise<void> {
  const set: Record<string, unknown> = {};
  if (values.name !== undefined) {
    set.name = values.name.trim();
    set.key = contactKey(values.name);
  }
  if (values.phone !== undefined) set.phone = normalizePhone(values.phone) || null;
  if (!Object.keys(set).length) return;
  await db
    .update(contacts)
    .set(set)
    .where(sql`${contacts.id} = ${id} and ${contacts.userId} = ${userId}`);
}

export async function deleteContact(userId: string, id: string): Promise<void> {
  await db.delete(contacts).where(sql`${contacts.id} = ${id} and ${contacts.userId} = ${userId}`);
}
