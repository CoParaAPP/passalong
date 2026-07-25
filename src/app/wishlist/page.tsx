/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * The wishlist: cards a member wants, plus a picker of cards from the
 * neighborhood catalog they don't already have.
 */

import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOnboardedUserId } from "@/lib/guards";
import { Hero } from "../hero";

export const dynamic = "force-dynamic";

function CardArt({ cover, title }: { cover: string | null; title: string }) {
  return (
    <div className="art">
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt={title} loading="lazy" />
      ) : (
        <div className="art-fallback" aria-hidden="true" />
      )}
    </div>
  );
}

export default async function Wishlist() {
  const userId = await requireOnboardedUserId();

  const [allCards, owned, wished] = await Promise.all([
    db.select().from(schema.cards).orderBy(schema.cards.title),
    db
      .select({ cardId: schema.ownership.cardId })
      .from(schema.ownership)
      .where(eq(schema.ownership.userId, userId)),
    db
      .select({ cardId: schema.wishlist.cardId })
      .from(schema.wishlist)
      .where(eq(schema.wishlist.userId, userId)),
  ]);

  const ownedIds = new Set(owned.map((o) => o.cardId));
  const wishedIds = new Set(wished.map((w) => w.cardId));

  const wantCards = allCards.filter((c) => wishedIds.has(c.id));
  // The picker: catalog cards you neither own nor already want.
  const addable = allCards.filter(
    (c) => !ownedIds.has(c.id) && !wishedIds.has(c.id)
  );

  return (
    <>
      <Hero active="wishlist" />
      <main className="shelf">
      <header className="shelf-head">
        <h1>Your wishlist</h1>
        <p>
          Mark cards you&apos;re hoping to borrow or swap for. When a neighbor
          who has one is nearby, that&apos;s how you&apos;ll find each other.
        </p>
      </header>

      {wantCards.length > 0 ? (
        <ul className="grid">
          {wantCards.map((c) => (
            <li key={c.id} className="cell">
              <CardArt cover={c.coverImageUrl} title={c.title} />
              <p className="title">{c.title}</p>
              <form method="post" action="/wishlist/toggle" className="card-toggle">
                <input type="hidden" name="cardId" value={c.id} />
                <input type="hidden" name="action" value="remove" />
                <button type="submit" className="toggle revoke">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">Nothing on your wishlist yet. Add some below.</p>
      )}

      <header className="shelf-head section">
        <h2>Add from the neighborhood catalog</h2>
        <p>Cards neighbors have synced that you don&apos;t already have.</p>
      </header>

      {addable.length > 0 ? (
        <ul className="grid">
          {addable.map((c) => (
            <li key={c.id} className="cell">
              <CardArt cover={c.coverImageUrl} title={c.title} />
              <p className="title">{c.title}</p>
              <form method="post" action="/wishlist/toggle" className="card-toggle">
                <input type="hidden" name="cardId" value={c.id} />
                <input type="hidden" name="action" value="add" />
                <button type="submit" className="toggle offer">
                  Add to wishlist
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">
          Nothing to add right now. As more neighbors join and sync their
          shelves, cards you don&apos;t have will show up here.
        </p>
      )}
      </main>
    </>
  );
}
