/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Browse: everything neighbors are offering right now, grouped by neighbor.
 * Only opt-in offers (lend/trade, available) ever appear — private and
 * off-limits cards are never shown, so nobody's library is a browsable
 * directory. Request a card straight from here.
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

export default async function Browse() {
  const userId = await requireOnboardedUserId();

  const offerRows = await db
    .select({
      cardId: schema.cards.id,
      title: schema.cards.title,
      cover: schema.cards.coverImageUrl,
      ownerId: schema.users.id,
      username: schema.users.username,
      visibility: schema.ownership.visibility,
    })
    .from(schema.ownership)
    .innerJoin(schema.cards, eq(schema.cards.id, schema.ownership.cardId))
    .innerJoin(schema.users, eq(schema.users.id, schema.ownership.userId))
    .where(
      and(
        ne(schema.ownership.userId, userId),
        eq(schema.ownership.status, "available"),
        inArray(schema.ownership.visibility, ["lend", "trade"])
      )
    )
    .orderBy(schema.users.username, schema.cards.title);

  const byOwner = new Map<
    string,
    {
      ownerId: string;
      username: string;
      cards: { cardId: string; title: string; cover: string | null; visibility: string }[];
    }
  >();
  for (const r of offerRows) {
    const entry = byOwner.get(r.ownerId) ?? {
      ownerId: r.ownerId,
      username: r.username ?? "a neighbor",
      cards: [],
    };
    entry.cards.push({
      cardId: r.cardId,
      title: r.title,
      cover: r.cover,
      visibility: r.visibility,
    });
    byOwner.set(r.ownerId, entry);
  }
  const offersByNeighbor = [...byOwner.values()];

  return (
    <>
      <Hero active="matches" />
      <main className="shelf">
      <header className="shelf-head">
        <h1>Browse</h1>
        <p>
          Cards your neighbors are offering right now. Tap Request to start a
          borrow or swap. Only offered cards show here, never anyone&apos;s
          private ones.
        </p>
      </header>

      {offersByNeighbor.length > 0 ? (
        offersByNeighbor.map((n) => (
          <section key={n.ownerId} className="neighbor">
            <h3 className="neighbor-name">{n.username}</h3>
            <ul className="grid">
              {n.cards.map((c) => (
                <li key={c.cardId} className="cell">
                  <div className="art">
                    {c.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.cover} alt={c.title} loading="lazy" />
                    ) : (
                      <div className="art-fallback" aria-hidden="true" />
                    )}
                  </div>
                  <p className="title">{c.title}</p>
                  <div className="offer-row">
                    <span className="offer-type">
                      {OFFER_LABEL[c.visibility] ?? "offered"}
                    </span>
                    <form method="post" action="/request">
                      <input type="hidden" name="to" value={n.ownerId} />
                      <input type="hidden" name="card" value={c.cardId} />
                      <input
                        type="hidden"
                        name="type"
                        value={c.visibility === "trade" ? "swap" : "borrow"}
                      />
                      <button type="submit" className="request">
                        {c.visibility === "trade" ? "Propose swap" : "Request"}
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <p className="empty">
          No one&apos;s offering cards yet. When neighbors offer cards from their
          shelves, they&apos;ll show up here.
        </p>
      )}
      </main>
    </>
  );
}
