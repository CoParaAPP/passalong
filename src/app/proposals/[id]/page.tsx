/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * One proposal's message thread. Only the two people on the proposal can see or
 * post to it. This is how a handoff gets arranged without sharing phone numbers.
 */

import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOnboardedUserId } from "@/lib/guards";
import { Hero } from "../../hero";

export const dynamic = "force-dynamic";

function when(ts: Date): string {
  return ts.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function Thread({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireOnboardedUserId();
  const { id } = await params;

  const [proposal] = await db
    .select({
      id: schema.proposals.id,
      fromUserId: schema.proposals.fromUserId,
      toUserId: schema.proposals.toUserId,
      cardTitle: schema.cards.title,
      type: schema.proposals.type,
      status: schema.proposals.status,
      returnBy: schema.proposals.returnBy,
    })
    .from(schema.proposals)
    .innerJoin(schema.cards, eq(schema.cards.id, schema.proposals.cardId))
    .where(eq(schema.proposals.id, id))
    .limit(1);

  // Only the two participants may open the thread.
  if (!proposal || (proposal.fromUserId !== me && proposal.toUserId !== me)) {
    redirect("/proposals");
  }

  const otherId =
    proposal.fromUserId === me ? proposal.toUserId : proposal.fromUserId;
  const [other] = await db
    .select({ username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.id, otherId))
    .limit(1);

  const thread = await db
    .select({
      id: schema.messages.id,
      fromUserId: schema.messages.fromUserId,
      body: schema.messages.body,
      createdAt: schema.messages.createdAt,
    })
    .from(schema.messages)
    .where(eq(schema.messages.proposalId, id))
    .orderBy(asc(schema.messages.createdAt));

  const verb = proposal.type === "swap" ? "swap" : "borrow";
  const iAmOwner = proposal.toUserId === me;
  const pending = proposal.status === "pending";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Hero active="proposals" />
      <main className="shelf">
      <header className="shelf-head">
        <h1>Messages with {other?.username ?? "a neighbor"}</h1>
        <p>
          About the {verb} of <strong>{proposal.cardTitle}</strong> ·{" "}
          <span className={`status status-${proposal.status}`}>
            {proposal.status}
          </span>
          {proposal.type === "borrow" &&
            proposal.returnBy &&
            ` · due ${proposal.returnBy}`}
        </p>
      </header>

      {pending && iAmOwner && (
        <div className="proposal">
          <p className="proposal-line">
            <strong>{other?.username ?? "A neighbor"}</strong> is asking to{" "}
            {verb} <strong>{proposal.cardTitle}</strong>.
          </p>
          <div className="proposal-actions">
            <form method="post" action="/proposals/respond" className="accept-form">
              <input type="hidden" name="proposalId" value={proposal.id} />
              <input type="hidden" name="action" value="accept" />
              {proposal.type === "borrow" && (
                <label className="due-label">
                  Back by (optional, for a reminder)
                  <input type="date" name="returnBy" min={today} />
                </label>
              )}
              <button type="submit" className="toggle offer">
                Accept
              </button>
            </form>
            <form method="post" action="/proposals/respond">
              <input type="hidden" name="proposalId" value={proposal.id} />
              <input type="hidden" name="action" value="decline" />
              <button type="submit" className="toggle revoke">
                Decline
              </button>
            </form>
          </div>
          <p className="fineprint">
            By accepting you both agree to the borrow &amp; swap terms you signed
            when you joined.
          </p>
        </div>
      )}

      {pending && !iAmOwner && (
        <div className="proposal">
          <p className="status status-pending">
            Waiting for {other?.username ?? "them"} to accept.
          </p>
          <form method="post" action="/proposals/withdraw">
            <input type="hidden" name="proposalId" value={proposal.id} />
            <button type="submit" className="toggle revoke">
              Withdraw request
            </button>
          </form>
        </div>
      )}

      <ul className="thread">
        {thread.length === 0 ? (
          <li className="empty">
            No messages yet. Say hello and sort out where and when to meet.
          </li>
        ) : (
          thread.map((m) => (
            <li
              key={m.id}
              className={m.fromUserId === me ? "msg mine" : "msg"}
            >
              <p className="msg-body">{m.body}</p>
              <p className="msg-meta">
                {m.fromUserId === me ? "You" : other?.username ?? "Neighbor"} ·{" "}
                {when(m.createdAt)}
              </p>
            </li>
          ))
        )}
      </ul>

      <form method="post" action={`/proposals/${proposal.id}/message`} className="msg-form">
        <textarea
          name="body"
          rows={2}
          maxLength={1000}
          placeholder="Write a message…"
          required
        />
        <button type="submit" className="primary">
          Send
        </button>
      </form>

      <p className="fineprint">
        Keep it in here. No need to share phone numbers or addresses.{" "}
        <a href="/proposals">Back to proposals</a> ·{" "}
        <a href={`/flag?proposal=${proposal.id}`}>Flag to organizer</a>
      </p>
      </main>
    </>
  );
}
