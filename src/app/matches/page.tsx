/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Matches: for each card on your wishlist, which neighbors are offering it.
 * Pull-based by design: you only see owners for cards you asked for, and there
 * is no browsable directory of who owns what.
 */

import { and, eq, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOnboardedUserId } from "@/lib/guards";
import { Hero } from "../hero";

export const dynamic = "force-dynamic";

const OFFER_LABEL: Record<string, string> = {
  lend: "to lend",
  trade: "to trade",
};

export default async function Matches() {
  const userId = await requireOnboardedUserId();

  // Every offer, by another member, of a card on my wishlist.
  const rows = await db
    .select({
      cardId: schema.cards.id,
      title: schema.cards.title,
      cover: schema.cards.coverImageUrl,
      ownerId: schema.users.id,
      username: schema.users.username,
      visibility: schema.ownership.visibility,
    })
    .from(schema.wishlist)
    .innerJoin(
      schema.ownership,
      and(
        eq(schema.ownership.cardId, schema.wishlist.cardId),
        ne(schema.ownership.userId, userId),
        eq(schema.ownership.status, "available"),
        inArray(schema.ownership.visibility, ["lend", "trade"])
      )
    )
    .innerJoin(schema.cards, eq(schema.cards.id, schema.wishlist.cardId))
    .innerJoin(schema.users, eq(schema.users.id, schema.ownership.userId))
    .where(eq(schema.wishlist.userId, userId))
    .orderBy(schema.cards.title, schema.users.username);

  // Group offers under each wanted card.
  const byCard = new Map<
    string,
    {
      cardId: string;
      title: string;
      cover: string | null;
      offers: { ownerId: string; username: string; visibility: string }[];
    }
  >();
  for (const r of rows) {
    const entry = byCard.get(r.cardId) ?? {
      cardId: r.cardId,
      title: r.title,
      cover: r.cover,
      offers: [],
    };
    entry.offers.push({
      ownerId: r.ownerId,
      username: r.username ?? "a neighbor",
      visibility: r.visibility,
    });
    byCard.set(r.cardId, entry);
  }
  const matches = [...byCard.values()];

  return (
    <>
      <Hero active="matches" />
      <main className="shelf">
      <header className="shelf-head">
        <h1>Matches</h1>
        <p>
          Cards on your wishlist that a neighbor is offering right now. Reach out
          to arrange a borrow or swap.
        </p>
      </header>

      {matches.length > 0 ? (
        <ul className="grid">
          {matches.map((m) => (
            <li key={m.cardId} className="cell">
              <div className="art">
                {m.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.cover} alt={m.title} loading="lazy" />
                ) : (
                  <div className="art-fallback" aria-hidden="true" />
                )}
              </div>
              <p className="title">{m.title}</p>
              <ul className="offers">
                {m.offers.map((o, i) => (
                  <li key={i}>
                    <span>
                      {o.username}{" "}
                      <span className="offer-type">
                        {OFFER_LABEL[o.visibility] ?? "offered"}
                      </span>
                    </span>
                    <a
                      className="request"
                      href={`/propose?to=${o.ownerId}&card=${m.cardId}&type=${
                        o.visibility === "trade" ? "swap" : "borrow"
                      }`}
                    >
                      {o.visibility === "trade" ? "Propose swap" : "Request"}
                    </a>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">
          No matches yet. Add cards to your{" "}
          <a href="/wishlist">wishlist</a>, and when a neighbor offers one it
          will show up here.
        </p>
      )}
      </main>
    </>
  );
}
