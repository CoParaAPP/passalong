/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Propose a borrow or a swap for a card a neighbor is offering. Shows the terms,
 * a return-by date for borrows, and (for swaps) a picker of your own offered
 * cards to give in exchange.
 */

import { redirect } from "next/navigation";
import { and, eq, inArray, ne } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOnboardedUserId } from "@/lib/guards";
import {
  TERMS_CLOSING,
  TERMS_PROMISES,
  TERMS_TITLE,
} from "@/lib/terms";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  returnby: "Pick a return-by date in the future.",
  offered: "Choose one of your cards to offer in the swap.",
  agree: "Please agree to the terms to send the proposal.",
  duplicate: "You already have a pending proposal for this card with this neighbor.",
};

export default async function Propose({
  searchParams,
}: {
  searchParams: Promise<{
    to?: string;
    card?: string;
    type?: string;
    error?: string;
  }>;
}) {
  const me = await requireOnboardedUserId();
  const { to, card, type, error } = await searchParams;

  if ((type !== "borrow" && type !== "swap") || !to || !card || to === me) {
    redirect("/matches");
  }

  const [owner] = await db
    .select({ username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.id, to!))
    .limit(1);

  const [theCard] = await db
    .select({ title: schema.cards.title, cover: schema.cards.coverImageUrl })
    .from(schema.cards)
    .where(eq(schema.cards.id, card!))
    .limit(1);

  // The owner must actually be offering this card.
  const [offer] = await db
    .select({ visibility: schema.ownership.visibility })
    .from(schema.ownership)
    .where(
      and(
        eq(schema.ownership.userId, to!),
        eq(schema.ownership.cardId, card!),
        inArray(schema.ownership.visibility, ["lend", "trade"])
      )
    )
    .limit(1);

  if (!owner || !theCard || !offer) redirect("/matches");

  // For a swap, the proposer offers one of their own offered cards.
  const myOfferedCards =
    type === "swap"
      ? await db
          .select({ id: schema.cards.id, title: schema.cards.title })
          .from(schema.ownership)
          .innerJoin(schema.cards, eq(schema.cards.id, schema.ownership.cardId))
          .where(
            and(
              eq(schema.ownership.userId, me),
              ne(schema.ownership.cardId, card!),
              inArray(schema.ownership.visibility, ["lend", "trade"])
            )
          )
          .orderBy(schema.cards.title)
      : [];

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="onboard">
      <h1>{type === "borrow" ? "Request to borrow" : "Propose a swap"}</h1>
      <p>
        {theCard.title} — from {owner.username}. Send a proposal; they&apos;ll
        accept or decline.
      </p>

      {error && <p className="form-error">{ERRORS[error] ?? "Please check the form."}</p>}

      <form method="post" action="/propose/submit" className="stack">
        <input type="hidden" name="to" value={to} />
        <input type="hidden" name="card" value={card} />
        <input type="hidden" name="type" value={type} />

        {type === "borrow" && (
          <>
            <label htmlFor="returnBy">Return by</label>
            <input
              type="date"
              id="returnBy"
              name="returnBy"
              min={today}
              required
            />
          </>
        )}

        {type === "swap" && (
          <>
            <label htmlFor="offeredCardId">Offer one of your cards</label>
            {myOfferedCards.length > 0 ? (
              <select id="offeredCardId" name="offeredCardId" required>
                <option value="">Choose a card…</option>
                {myOfferedCards.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            ) : (
              <p className="form-error">
                You have no cards offered to lend or trade yet. Offer some on
                your <a href="/shelf">shelf</a> first.
              </p>
            )}
          </>
        )}

        <section className="covenant" aria-label={TERMS_TITLE}>
          <h2>{TERMS_TITLE}</h2>
          <dl>
            {TERMS_PROMISES.map((p) => (
              <div key={p.title}>
                <dt>{p.title}</dt>
                <dd>{p.body}</dd>
              </div>
            ))}
          </dl>
          <p>{TERMS_CLOSING}</p>
        </section>

        <label className="agree">
          <input type="checkbox" name="agree" value="yes" required /> I&apos;ve
          read and agree to these terms for this exchange.
        </label>

        <button type="submit" className="primary">
          Send proposal
        </button>
      </form>
      <p className="fineprint">
        <a href="/matches">Back to matches</a>
      </p>
    </main>
  );
}
