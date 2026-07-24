/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Turns a raw /card/family/library response into stored cards. The commercial
 * gate is `card.userId === "yoto"`: every official card carries it, and a Make
 * Your Own card would carry the family's own id instead, so this both keeps
 * commercial cards and structurally excludes self-created ones. When in doubt,
 * exclude. Only cardId, title, and cover image are kept; nothing else.
 */

import "server-only";
import { sql } from "drizzle-orm";
import { db, schema } from "./db";

export interface CommercialCard {
  cardId: string;
  title: string;
  coverImageUrl: string | null;
}

// Minimal shape we read from the response. Extra fields are ignored.
interface RawEntry {
  cardId?: string;
  card?: {
    cardId?: string;
    title?: string;
    userId?: string;
    metadata?: { cover?: { imageL?: string } };
    content?: { cover?: { imageL?: string } };
  };
}

export function filterCommercialCards(raw: unknown): CommercialCard[] {
  const cards = (raw as { cards?: unknown })?.cards;
  if (!Array.isArray(cards)) return [];

  const out: CommercialCard[] = [];
  for (const entry of cards as RawEntry[]) {
    const card = entry?.card;
    // The gate: official commercial content only.
    if (!card || card.userId !== "yoto") continue;

    const cardId = entry.cardId ?? card.cardId;
    const title = card.title;
    if (!cardId || !title) continue;

    const coverImageUrl =
      card.metadata?.cover?.imageL ?? card.content?.cover?.imageL ?? null;
    out.push({ cardId, title, coverImageUrl });
  }
  return out;
}

/**
 * Upsert the member's commercial cards. Catalog rows are refreshed; ownership
 * rows are inserted only when new and arrive unlisted, so a re-sync never
 * changes what a member has already chosen to share.
 */
export async function syncLibrary(
  userId: string,
  raw: unknown
): Promise<{ synced: number }> {
  const commercial = filterCommercialCards(raw);
  if (commercial.length === 0) return { synced: 0 };

  await db.transaction(async (tx) => {
    await tx
      .insert(schema.cards)
      .values(
        commercial.map((c) => ({
          id: c.cardId,
          title: c.title,
          coverImageUrl: c.coverImageUrl,
        }))
      )
      .onConflictDoUpdate({
        target: schema.cards.id,
        set: {
          title: sql`excluded.title`,
          coverImageUrl: sql`excluded.cover_image_url`,
        },
      });

    await tx
      .insert(schema.ownership)
      .values(commercial.map((c) => ({ userId, cardId: c.cardId })))
      .onConflictDoNothing();
  });

  return { synced: commercial.length };
}
