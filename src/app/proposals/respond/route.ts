/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * The owner accepts or declines a proposal. Only the owner (the to-user) can
 * respond, and only while it is still pending. Accepting a borrow creates a
 * loan and marks the card on_loan; accepting a swap transfers ownership of both
 * cards. Ownership only ever moves through an explicit action like this, never
 * through a sync.
 */

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOnboardedUserId } from "@/lib/guards";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const me = await requireOnboardedUserId();
  const backToProposals = NextResponse.redirect(new URL("/proposals", origin), {
    status: 303,
  });

  const form = await request.formData();
  const proposalId = (form.get("proposalId") ?? "").toString();
  const action = (form.get("action") ?? "").toString();
  const conditionNote = (form.get("conditionNote") ?? "").toString().trim();
  const agreed = form.get("agree") === "yes";

  if (!proposalId || (action !== "accept" && action !== "decline")) {
    return backToProposals;
  }

  const [proposal] = await db
    .select({
      id: schema.proposals.id,
      fromUserId: schema.proposals.fromUserId,
      toUserId: schema.proposals.toUserId,
      cardId: schema.proposals.cardId,
      type: schema.proposals.type,
      offeredCardId: schema.proposals.offeredCardId,
      returnBy: schema.proposals.returnBy,
      status: schema.proposals.status,
    })
    .from(schema.proposals)
    .where(eq(schema.proposals.id, proposalId))
    .limit(1);

  // Only the owner can respond, and only to a still-pending proposal.
  if (!proposal || proposal.toUserId !== me || proposal.status !== "pending") {
    return backToProposals;
  }

  if (action === "decline") {
    await db
      .update(schema.proposals)
      .set({ status: "declined", updatedAt: new Date() })
      .where(eq(schema.proposals.id, proposalId));
    return backToProposals;
  }

  // Accepting requires agreeing to the terms.
  if (!agreed) return backToProposals;

  try {
    await db.transaction(async (tx) => {
      // The owner's ownership row for the requested card must still be available.
      const [ownRow] = await tx
        .select({ id: schema.ownership.id, status: schema.ownership.status })
        .from(schema.ownership)
        .where(
          and(
            eq(schema.ownership.userId, me),
            eq(schema.ownership.cardId, proposal.cardId)
          )
        )
        .limit(1);
      if (!ownRow || ownRow.status !== "available") throw new Error("UNAVAILABLE");

      if (proposal.type === "borrow") {
        const [loan] = await tx
          .insert(schema.loans)
          .values({
            ownershipId: ownRow.id,
            lenderId: me,
            borrowerId: proposal.fromUserId,
            cardId: proposal.cardId,
            dueBy: proposal.returnBy,
            status: "active",
          })
          .returning({ id: schema.loans.id });

        await tx
          .update(schema.ownership)
          .set({ status: "on_loan", currentLoanId: loan.id })
          .where(eq(schema.ownership.id, ownRow.id));
      } else {
        // Swap: the two cards change hands permanently. New owners get the card
        // unlisted and available so they choose their own sharing.
        const offeredId = proposal.offeredCardId;
        if (!offeredId) throw new Error("NO_OFFERED_CARD");

        // The proposer's offered card must still be theirs and available.
        const [offeredRow] = await tx
          .select({ id: schema.ownership.id, status: schema.ownership.status })
          .from(schema.ownership)
          .where(
            and(
              eq(schema.ownership.userId, proposal.fromUserId),
              eq(schema.ownership.cardId, offeredId)
            )
          )
          .limit(1);
        if (!offeredRow || offeredRow.status !== "available") {
          throw new Error("OFFERED_UNAVAILABLE");
        }

        // Requested card -> proposer.
        await tx
          .update(schema.ownership)
          .set({ userId: proposal.fromUserId, visibility: "unlisted", status: "available" })
          .where(eq(schema.ownership.id, ownRow.id));
        // Offered card -> owner (me).
        await tx
          .update(schema.ownership)
          .set({ userId: me, visibility: "unlisted", status: "available" })
          .where(eq(schema.ownership.id, offeredRow.id));
      }

      await tx
        .update(schema.proposals)
        .set({
          status: proposal.type === "swap" ? "completed" : "accepted",
          conditionNote: conditionNote || null,
          updatedAt: new Date(),
        })
        .where(eq(schema.proposals.id, proposalId));
    });
  } catch {
    // The card (or the offered card) is no longer available; leave everything as
    // is and send the owner back. The proposal stays pending to retry or decline.
    return backToProposals;
  }

  return backToProposals;
}
