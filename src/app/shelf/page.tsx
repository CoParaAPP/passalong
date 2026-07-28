/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * The shelf: a member's owned commercial cards as a cover-art grid, plus the
 * cards they've lent out and the ones they're currently borrowing. Everything
 * arrives unlisted; sharing is an explicit opt-in.
 */

import { aliasedTable, and, desc, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOnboardedUserId } from "@/lib/guards";
import { Hero } from "../hero";
import { EnablePush } from "../enable-push";

export const dynamic = "force-dynamic";

export default async function Shelf({
  searchParams,
}: {
  searchParams: Promise<{ returned?: string; handedback?: string }>;
}) {
  const userId = await requireOnboardedUserId();
  const { returned, handedback } = await searchParams;

  // Unread reminders from the scheduled return-reminder job.
  const reminders = await db
    .select({
      id: schema.notifications.id,
      body: schema.notifications.body,
      kind: schema.notifications.kind,
    })
    .from(schema.notifications)
    .where(
      and(
        eq(schema.notifications.userId, userId),
        isNull(schema.notifications.readAt)
      )
    )
    .orderBy(desc(schema.notifications.createdAt));

  const borrower = aliasedTable(schema.users, "borrower");
  const lender = aliasedTable(schema.users, "lender");

  // Cards the member owns, with any active loan (borrower + due date).
  const owned = await db
    .select({
      cardId: schema.cards.id,
      title: schema.cards.title,
      cover: schema.cards.coverImageUrl,
      visibility: schema.ownership.visibility,
      status: schema.ownership.status,
      loanId: schema.loans.id,
      dueBy: schema.loans.dueBy,
      borrowerName: borrower.username,
    })
    .from(schema.ownership)
    .innerJoin(schema.cards, eq(schema.ownership.cardId, schema.cards.id))
    .leftJoin(
      schema.loans,
      and(
        eq(schema.loans.id, schema.ownership.currentLoanId),
        eq(schema.loans.status, "active")
      )
    )
    .leftJoin(borrower, eq(borrower.id, schema.loans.borrowerId))
    .where(eq(schema.ownership.userId, userId))
    .orderBy(schema.cards.title);

  // Cards the member is currently borrowing from neighbors.
  const borrowing = await db
    .select({
      cardId: schema.cards.id,
      title: schema.cards.title,
      cover: schema.cards.coverImageUrl,
      dueBy: schema.loans.dueBy,
      loanId: schema.loans.id,
      lenderName: lender.username,
    })
    .from(schema.loans)
    .innerJoin(schema.cards, eq(schema.cards.id, schema.loans.cardId))
    .innerJoin(lender, eq(lender.id, schema.loans.lenderId))
    .where(and(eq(schema.loans.borrowerId, userId), eq(schema.loans.status, "active")))
    .orderBy(schema.cards.title);

  const available = owned.filter((c) => c.status === "available");
  const unlistedCount = available.filter((c) => c.visibility === "unlisted").length;
  const offeredCount = available.filter(
    (c) => c.visibility === "lend" || c.visibility === "trade"
  ).length;
  const offLimitsCount = available.filter(
    (c) => c.visibility === "off_limits"
  ).length;

  return (
    <>
      <Hero active="shelf" />
      <main className="shelf">
      <EnablePush />
      {reminders.length > 0 && (
        <ul className="reminders">
          {reminders.map((n) => (
            <li
              key={n.id}
              className={
                n.kind === "return_overdue" ? "reminder overdue" : "reminder"
              }
            >
              <span>{n.body}</span>
              <form method="post" action="/notifications/dismiss">
                <input type="hidden" name="id" value={n.id} />
                <button type="submit" className="dismiss">
                  Dismiss
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <header className="shelf-head">
        <h1>Your shelf</h1>
        <p>
          {owned.length} card{owned.length === 1 ? "" : "s"}
          {offeredCount > 0 && ` · ${offeredCount} offered`}
          {unlistedCount > 0 && ` · ${unlistedCount} private`}
          {offLimitsCount > 0 && ` · ${offLimitsCount} off-limits`}. Offer a card,
          keep it private, or mark it off-limits so it&apos;s shown but never
          asked for.
        </p>
        {returned && (
          <p className="reminder">
            Marked returned. When you get {returned} back, tap it into your own
            Yoto player to restore it to your library.
          </p>
        )}
        {handedback && (
          <p className="reminder">
            Marked returned. The owner has been reminded to tap {handedback} back
            into their player.
          </p>
        )}
        {unlistedCount > 0 && (
          <form method="post" action="/shelf/offer">
            <button className="offer-all" type="submit">
              Offer all {unlistedCount} remaining to the group
            </button>
          </form>
        )}
      </header>

      <ul className="grid">
        {owned.map((c) => {
          const onLoan = c.status === "on_loan";
          const offered = c.visibility === "lend" || c.visibility === "trade";
          const offLimits = c.visibility === "off_limits";
          return (
            <li key={c.cardId} className="cell">
              <div className="art">
                {c.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.cover} alt={c.title} loading="lazy" />
                ) : (
                  <div className="art-fallback" aria-hidden="true" />
                )}
                {onLoan ? (
                  <span className="badge loan">on loan</span>
                ) : offered ? (
                  <span className="badge">offered</span>
                ) : (
                  offLimits && <span className="badge limits">off-limits</span>
                )}
              </div>
              <p className="title">{c.title}</p>
              {onLoan ? (
                <div className="card-toggle">
                  <p className="loan-note">
                    Lent to {c.borrowerName ?? "a neighbor"}
                    {c.dueBy && `, due ${c.dueBy}`}
                  </p>
                  <form method="post" action="/shelf/return">
                    <input type="hidden" name="loanId" value={c.loanId ?? ""} />
                    <button type="submit" className="toggle revoke">
                      Mark returned
                    </button>
                  </form>
                </div>
              ) : offered ? (
                <form method="post" action="/shelf/toggle" className="card-toggle">
                  <input type="hidden" name="cardId" value={c.cardId} />
                  <input type="hidden" name="to" value="unlisted" />
                  <button type="submit" className="toggle revoke">
                    Stop offering
                  </button>
                </form>
              ) : offLimits ? (
                <form method="post" action="/shelf/toggle" className="card-toggle">
                  <input type="hidden" name="cardId" value={c.cardId} />
                  <input type="hidden" name="to" value="unlisted" />
                  <button type="submit" className="toggle offer">
                    Make available
                  </button>
                </form>
              ) : (
                <div className="card-toggle two">
                  <form method="post" action="/shelf/toggle">
                    <input type="hidden" name="cardId" value={c.cardId} />
                    <input type="hidden" name="to" value="lend" />
                    <button type="submit" className="toggle offer">
                      Offer
                    </button>
                  </form>
                  <form method="post" action="/shelf/toggle">
                    <input type="hidden" name="cardId" value={c.cardId} />
                    <input type="hidden" name="to" value="off_limits" />
                    <button type="submit" className="toggle limits">
                      Off-limits
                    </button>
                  </form>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {borrowing.length > 0 && (
        <>
          <header className="shelf-head section">
            <h2>Borrowed from neighbors</h2>
            <p>These are on loan to you. They&apos;re not yours to offer.</p>
          </header>
          <ul className="grid">
            {borrowing.map((c) => (
              <li key={c.cardId} className="cell">
                <div className="art">
                  {c.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.cover} alt={c.title} loading="lazy" />
                  ) : (
                    <div className="art-fallback" aria-hidden="true" />
                  )}
                  <span className="badge loan">borrowed</span>
                </div>
                <p className="title">{c.title}</p>
                <p className="loan-note">
                  From {c.lenderName ?? "a neighbor"}
                  {c.dueBy && `, due ${c.dueBy}`}
                </p>
                <form method="post" action="/shelf/return" className="card-toggle">
                  <input type="hidden" name="loanId" value={c.loanId ?? ""} />
                  <button type="submit" className="toggle revoke">
                    Mark returned
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </>
      )}
      </main>
    </>
  );
}
