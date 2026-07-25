/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Report something to the organizer. Anything that needs a human. Can be opened
 * on its own or from a proposal for context.
 */

import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOnboardedUserId } from "@/lib/guards";
import { Nav } from "../nav";

export const dynamic = "force-dynamic";

export default async function Flag({
  searchParams,
}: {
  searchParams: Promise<{ proposal?: string; sent?: string }>;
}) {
  const me = await requireOnboardedUserId();
  const { proposal, sent } = await searchParams;

  // If opened from a proposal, prefill context and confirm the viewer is on it.
  let proposalId = "";
  let contextHint = "";
  if (proposal) {
    const [p] = await db
      .select({
        fromUserId: schema.proposals.fromUserId,
        toUserId: schema.proposals.toUserId,
        cardTitle: schema.cards.title,
        type: schema.proposals.type,
      })
      .from(schema.proposals)
      .innerJoin(schema.cards, eq(schema.cards.id, schema.proposals.cardId))
      .where(eq(schema.proposals.id, proposal))
      .limit(1);
    if (p && (p.fromUserId === me || p.toUserId === me)) {
      proposalId = proposal;
      contextHint = `About the ${p.type} of ${p.cardTitle}`;
    }
  }

  return (
    <main className="onboard">
      <Nav active="report" />
      <h1>Tell the organizer</h1>
      <p>
        If something feels off, or you just need a hand, send it here. An
        organizer will see it. Be as clear as you can.
      </p>

      {sent && (
        <p className="reminder">
          Thanks. The organizer has it and will follow up. <a href="/shelf">Back to your shelf</a>.
        </p>
      )}

      <form method="post" action="/flag/submit" className="stack">
        {proposalId && (
          <input type="hidden" name="proposalId" value={proposalId} />
        )}
        <label htmlFor="context">What&apos;s this about? (optional)</label>
        <input
          id="context"
          name="context"
          defaultValue={contextHint}
          placeholder="A card, a neighbor, a borrow…"
          maxLength={200}
        />
        <label htmlFor="body">What happened?</label>
        <textarea id="body" name="body" rows={5} maxLength={2000} required />
        <button type="submit" className="primary">
          Send to organizer
        </button>
      </form>
    </main>
  );
}
