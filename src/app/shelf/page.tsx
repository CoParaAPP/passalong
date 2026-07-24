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

  // Not finished onboarding yet: send them to pick a name and agree first.
  const [member] = await db
    .select({
      username: schema.users.username,
      covenantVersionAgreed: schema.users.covenantVersionAgreed,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  if (!member?.username || !member.covenantVersionAgreed) redirect("/welcome");

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
  const offeredCount = cards.length - unlistedCount;

  return (
    <main className="shelf">
      <header className="shelf-head">
        <h1>Your shelf</h1>
        <p>
          {cards.length} card{cards.length === 1 ? "" : "s"} synced
          {offeredCount > 0 && ` · ${offeredCount} offered`}
          {unlistedCount > 0 && ` · ${unlistedCount} private`}. Offer cards one at
          a time below, or pull any back to private whenever you like.
        </p>
        {unlistedCount > 0 && (
          <form method="post" action="/shelf/offer">
            <button className="offer-all" type="submit">
              Offer all {unlistedCount} remaining to the group
            </button>
          </form>
        )}
      </header>

      <ul className="grid">
        {cards.map((c) => {
          const offered = c.visibility !== "unlisted";
          return (
            <li key={c.cardId} className="cell">
              <div className="art">
                {c.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.cover} alt={c.title} loading="lazy" />
                ) : (
                  <div className="art-fallback" aria-hidden="true" />
                )}
                {offered && <span className="badge">offered</span>}
              </div>
              <p className="title">{c.title}</p>
              <form method="post" action="/shelf/toggle" className="card-toggle">
                <input type="hidden" name="cardId" value={c.cardId} />
                <input
                  type="hidden"
                  name="action"
                  value={offered ? "revoke" : "offer"}
                />
                <button
                  type="submit"
                  className={offered ? "toggle revoke" : "toggle offer"}
                >
                  {offered ? "Stop offering" : "Offer"}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
