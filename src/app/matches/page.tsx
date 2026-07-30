/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Matches: for each card on your wishlist, which neighbors are offering it, plus
 * a browse view of everything on offer grouped by neighbor. Only opt-in offers
 * (lend/trade) appear with a name attached; private and off-limits cards are
 * never shown, so nobody's full library is ever a browsable directory.
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

  // Everything on offer across the group, grouped by neighbor. Offered cards
  // only (never private/off-limits), so it's not a full-library directory.
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

      <header className="shelf-head section">
        <h2>Browse offers, by neighbor</h2>
        <p>
          Everything neighbors are offering right now. Private and off-limits
          cards never show here.
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
                    <a
                      className="request"
                      href={`/propose?to=${n.ownerId}&card=${c.cardId}&type=${
                        c.visibility === "trade" ? "swap" : "borrow"
                      }`}
                    >
                      {c.visibility === "trade" ? "Propose swap" : "Request"}
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <p className="empty">
          No one&apos;s offering cards yet. When neighbors offer from their
          shelves, they&apos;ll show up here.
        </p>
      )}
      </main>
    </>
  );
}
