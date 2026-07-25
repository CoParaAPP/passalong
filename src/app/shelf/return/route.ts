/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * The lender marks a loan returned. This clears the app's loan state and frees
 * the card to be offered again. Ownership never changed; only Yoto's view did,
 * so the shelf then reminds the lender to tap the card back into their player.
 */

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOnboardedUserId } from "@/lib/guards";

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
      ownershipId: schema.loans.ownershipId,
      cardId: schema.loans.cardId,
      status: schema.loans.status,
    })
    .from(schema.loans)
    .where(eq(schema.loans.id, loanId))
    .limit(1);

  // Only the lender can mark their own active loan returned.
  if (!loan || loan.lenderId !== me || loan.status !== "active") {
    return NextResponse.redirect(new URL("/shelf", origin), { status: 303 });
  }

  const [card] = await db
    .select({ title: schema.cards.title })
    .from(schema.cards)
    .where(eq(schema.cards.id, loan.cardId))
    .limit(1);

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
  back.searchParams.set("returned", card?.title ?? "the card");
  return NextResponse.redirect(back, { status: 303 });
}
