/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Proposals: what neighbors have asked you (accept or decline) and what you've
 * asked them (with status).
 */

import { desc, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOnboardedUserId } from "@/lib/guards";
import { Nav } from "../nav";

export const dynamic = "force-dynamic";

function typeLabel(type: string): string {
  return type === "swap" ? "swap" : "borrow";
}

export default async function Proposals() {
  const me = await requireOnboardedUserId();

  const incoming = await db
    .select({
      id: schema.proposals.id,
      other: schema.users.username,
      cardTitle: schema.cards.title,
      type: schema.proposals.type,
      status: schema.proposals.status,
      returnBy: schema.proposals.returnBy,
      offeredCardId: schema.proposals.offeredCardId,
      conditionNote: schema.proposals.conditionNote,
    })
    .from(schema.proposals)
    .innerJoin(schema.users, eq(schema.users.id, schema.proposals.fromUserId))
    .innerJoin(schema.cards, eq(schema.cards.id, schema.proposals.cardId))
    .where(eq(schema.proposals.toUserId, me))
    .orderBy(desc(schema.proposals.createdAt));

  const outgoing = await db
    .select({
      id: schema.proposals.id,
      other: schema.users.username,
      cardTitle: schema.cards.title,
      type: schema.proposals.type,
      status: schema.proposals.status,
      returnBy: schema.proposals.returnBy,
      offeredCardId: schema.proposals.offeredCardId,
      conditionNote: schema.proposals.conditionNote,
    })
    .from(schema.proposals)
    .innerJoin(schema.users, eq(schema.users.id, schema.proposals.toUserId))
    .innerJoin(schema.cards, eq(schema.cards.id, schema.proposals.cardId))
    .where(eq(schema.proposals.fromUserId, me))
    .orderBy(desc(schema.proposals.createdAt));

  // Resolve offered-card titles (for swaps) in one lookup.
  const offeredIds = [...incoming, ...outgoing]
    .map((p) => p.offeredCardId)
    .filter((id): id is string => Boolean(id));
  const offeredTitles = new Map<string, string>();
  if (offeredIds.length > 0) {
    const rows = await db
      .select({ id: schema.cards.id, title: schema.cards.title })
      .from(schema.cards)
      .where(inArray(schema.cards.id, offeredIds));
    for (const r of rows) offeredTitles.set(r.id, r.title);
  }

  return (
    <main className="shelf">
      <Nav active="proposals" />
      <header className="shelf-head">
        <h1>Proposals</h1>
        <p>Requests to you, and the ones you&apos;ve sent.</p>
      </header>

      <header className="shelf-head section">
        <h2>Asked of you</h2>
      </header>
      {incoming.length === 0 ? (
        <p className="empty">No one has asked you for a card yet.</p>
      ) : (
        <ul className="proposals">
          {incoming.map((p) => (
            <li key={p.id} className="proposal">
              <p className="proposal-line">
                <strong>{p.other}</strong> wants to {typeLabel(p.type)}{" "}
                <strong>{p.cardTitle}</strong>
                {p.type === "borrow" && p.returnBy && `, back by ${p.returnBy}`}
                {p.type === "swap" &&
                  p.offeredCardId &&
                  `, offering ${offeredTitles.get(p.offeredCardId) ?? "a card"}`}
                .
              </p>
              {p.status === "pending" ? (
                <div className="proposal-actions">
                  <form method="post" action="/proposals/respond" className="accept-form">
                    <input type="hidden" name="proposalId" value={p.id} />
                    <input type="hidden" name="action" value="accept" />
                    <input
                      type="text"
                      name="conditionNote"
                      placeholder="Note on condition (optional)"
                      maxLength={200}
                    />
                    <label className="agree">
                      <input type="checkbox" name="agree" value="yes" required /> I
                      agree to the borrow &amp; swap terms for this exchange.
                    </label>
                    <button type="submit" className="toggle offer">
                      Accept
                    </button>
                  </form>
                  <form method="post" action="/proposals/respond">
                    <input type="hidden" name="proposalId" value={p.id} />
                    <input type="hidden" name="action" value="decline" />
                    <button type="submit" className="toggle revoke">
                      Decline
                    </button>
                  </form>
                </div>
              ) : (
                <p className={`status status-${p.status}`}>
                  {p.status}
                  {p.status === "accepted" && p.conditionNote
                    ? ` — "${p.conditionNote}"`
                    : ""}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}

      <header className="shelf-head section">
        <h2>You asked</h2>
      </header>
      {outgoing.length === 0 ? (
        <p className="empty">
          You haven&apos;t asked for anything yet. Find cards on your{" "}
          <a href="/matches">matches</a>.
        </p>
      ) : (
        <ul className="proposals">
          {outgoing.map((p) => (
            <li key={p.id} className="proposal">
              <p className="proposal-line">
                You asked <strong>{p.other}</strong> to {typeLabel(p.type)}{" "}
                <strong>{p.cardTitle}</strong>
                {p.type === "borrow" && p.returnBy && `, back by ${p.returnBy}`}.
              </p>
              <p className={`status status-${p.status}`}>
                {p.status}
                {p.status === "accepted" && p.conditionNote
                  ? ` — "${p.conditionNote}"`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
