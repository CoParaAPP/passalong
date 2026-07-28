/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Either party marks a loan returned once the card is physically handed back.
 * This clears the app's loan state and frees the card to be offered again.
 * Ownership never changed; only Yoto's view did, so the lender is reminded to
 * tap the card back into their own player. If the borrower marks it, that
 * reminder goes to the lender as a notification.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOnboardedUserId } from "@/lib/guards";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const me = await requireOnboardedUserId();

  const form = await request.formData();
  const loanId = (form.get("loanId") ?? "").toString();
  if (!loanId) {
    return NextResponse.redirect(new URL("/shelf", origin), { status: 303 });
  }

  const [loan] = await db
    .select({
      id: schema.loans.id,
      lenderId: schema.loans.lenderId,
      borrowerId: schema.loans.borrowerId,
      ownershipId: schema.loans.ownershipId,
      cardId: schema.loans.cardId,
      status: schema.loans.status,
    })
    .from(schema.loans)
    .where(eq(schema.loans.id, loanId))
    .limit(1);

  // Either the lender or the borrower can mark their active loan returned.
  const isLender = loan?.lenderId === me;
  const isBorrower = loan?.borrowerId === me;
  if (!loan || (!isLender && !isBorrower) || loan.status !== "active") {
    return NextResponse.redirect(new URL("/shelf", origin), { status: 303 });
  }

  const [card] = await db
    .select({ title: schema.cards.title })
    .from(schema.cards)
    .where(eq(schema.cards.id, loan.cardId))
    .limit(1);
  const title = card?.title ?? "the card";

  await db.transaction(async (tx) => {
    await tx
      .update(schema.loans)
      .set({ status: "returned", returnedAt: new Date() })
      .where(eq(schema.loans.id, loanId));

    if (loan.ownershipId) {
      await tx
        .update(schema.ownership)
        .set({ status: "available", currentLoanId: null })
        .where(eq(schema.ownership.id, loan.ownershipId));
    }
  });

  const back = new URL("/shelf", origin);

  if (isBorrower) {
    // Let the lender know it's back and remind them to tap it into their player.
    const [meRow] = await db
      .select({ username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.id, me))
      .limit(1);
    await notify(loan.lenderId, {
      kind: "return",
      loanId: loan.id,
      body: `${meRow?.username ?? "A neighbor"} returned "${title}" — tap it back into your player to restore it to your library.`,
      url: "/shelf",
    });
    back.searchParams.set("handedback", title);
  } else {
    back.searchParams.set("returned", title);
  }

  return NextResponse.redirect(back, { status: 303 });
}
