/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * The owner accepts or declines from inside the request thread. Terms were
 * agreed once at signup, so there's no checkbox here. Accepting a borrow creates
 * a loan (with an optional return-by the owner can set) and marks the card
 * on_loan. Accepting a swap just records the agreement; the two trade the
 * physical cards themselves. Only the owner can respond, and only while pending.
 */

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOnboardedUserId } from "@/lib/guards";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const me = await requireOnboardedUserId();

  const form = await request.formData();
  const proposalId = (form.get("proposalId") ?? "").toString();
  const action = (form.get("action") ?? "").toString();
  const returnBy = (form.get("returnBy") ?? "").toString();

  const back = (id?: string) =>
    NextResponse.redirect(new URL(id ? `/proposals/${id}` : "/proposals", origin), {
      status: 303,
    });

  if (!proposalId || (action !== "accept" && action !== "decline")) return back();

  const [proposal] = await db
    .select({
      id: schema.proposals.id,
      fromUserId: schema.proposals.fromUserId,
      toUserId: schema.proposals.toUserId,
      cardId: schema.proposals.cardId,
      type: schema.proposals.type,
      status: schema.proposals.status,
    })
    .from(schema.proposals)
    .where(eq(schema.proposals.id, proposalId))
    .limit(1);

  // Only the owner can respond, and only to a still-pending request.
  if (!proposal || proposal.toUserId !== me || proposal.status !== "pending") {
    return back(proposalId);
  }

  if (action === "decline") {
    await db
      .update(schema.proposals)
      .set({ status: "declined", updatedAt: new Date() })
      .where(eq(schema.proposals.id, proposalId));
    await notify(proposal.fromUserId, {
      kind: "declined",
      body: `Your ${proposal.type} request was declined.`,
      url: `/proposals/${proposalId}`,
    });
    return back(proposalId);
  }

  const today = new Date().toISOString().slice(0, 10);
  try {
    await db.transaction(async (tx) => {
      if (proposal.type === "borrow") {
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

        const dueBy = returnBy && returnBy > today ? returnBy : null;
        const [loan] = await tx
          .insert(schema.loans)
          .values({
            ownershipId: ownRow.id,
            lenderId: me,
            borrowerId: proposal.fromUserId,
            cardId: proposal.cardId,
            dueBy,
            status: "active",
          })
          .returning({ id: schema.loans.id });
        await tx
          .update(schema.ownership)
          .set({ status: "on_loan", currentLoanId: loan.id })
          .where(eq(schema.ownership.id, ownRow.id));
        await tx
          .update(schema.proposals)
          .set({ status: "accepted", returnBy: dueBy, updatedAt: new Date() })
          .where(eq(schema.proposals.id, proposalId));
      } else {
        // Swap: record the agreement. The physical trade is theirs to make.
        await tx
          .update(schema.proposals)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(schema.proposals.id, proposalId));
      }
    });
  } catch {
    return back(proposalId);
  }

  await notify(proposal.fromUserId, {
    kind: "accepted",
    body: `Your ${proposal.type} request was accepted.`,
    url: `/proposals/${proposalId}`,
  });
  return back(proposalId);
}
