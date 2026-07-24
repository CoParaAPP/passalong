/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * The shelf: a member's synced commercial cards as a cover-art grid. Everything
 * arrives unlisted; a bulk action offers the unlisted ones to the group.
 */

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Shelf() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/");

  const cards = await db
    .select({
      cardId: schema.cards.id,
      title: schema.cards.title,
      cover: schema.cards.coverImageUrl,
      visibility: schema.ownership.visibility,
    })
    .from(schema.ownership)
    .innerJoin(schema.cards, eq(schema.ownership.cardId, schema.cards.id))
    .where(eq(schema.ownership.userId, userId))
    .orderBy(schema.cards.title);

  const unlistedCount = cards.filter((c) => c.visibility === "unlisted").length;

  return (
    <main className="shelf">
      <header className="shelf-head">
        <h1>Your shelf</h1>
        <p>
          {cards.length} card{cards.length === 1 ? "" : "s"} synced. Everything
          starts private. Nothing is shared with the group until you offer it.
        </p>
        {unlistedCount > 0 && (
          <form method="post" action="/shelf/offer">
            <button className="offer-all" type="submit">
              Offer {unlistedCount} card{unlistedCount === 1 ? "" : "s"} to the
              group
            </button>
          </form>
        )}
      </header>

      <ul className="grid">
        {cards.map((c) => (
          <li key={c.cardId} className="cell">
            <div className="art">
              {c.cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.cover} alt={c.title} loading="lazy" />
              ) : (
                <div className="art-fallback" aria-hidden="true" />
              )}
              {c.visibility !== "unlisted" && (
                <span className="badge">offered</span>
              )}
            </div>
            <p className="title">{c.title}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
