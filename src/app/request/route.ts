/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * One-tap request from Browse. Creates a pending proposal for a card a neighbor
 * is offering, notifies them, and opens the shared thread where they accept or
 * decline and the two coordinate. No separate proposal form; the terms are
 * agreed once at signup.
 */

import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOnboardedUserId } from "@/lib/guards";
import { TERMS_VERSION } from "@/lib/terms";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const me = await requireOnboardedUserId();
  const backToBrowse = NextResponse.redirect(new URL("/matches", origin), {
    status: 303,
  });

  const form = await request.formData();
  const toUserId = (form.get("to") ?? "").toString();
  const cardId = (form.get("card") ?? "").toString();
  const type = (form.get("type") ?? "").toString();

  if ((type !== "borrow" && type !== "swap") || !toUserId || !cardId || toUserId === me) {
    return backToBrowse;
  }

  // The card must still be on offer by that neighbor.
  const [offer] = await db
    .select({ v: schema.ownership.visibility })
    .from(schema.ownership)
    .where(
      and(
        eq(schema.ownership.userId, toUserId),
        eq(schema.ownership.cardId, cardId),
        eq(schema.ownership.status, "available"),
        inArray(schema.ownership.visibility, ["lend", "trade"])
      )
    )
    .limit(1);
  if (!offer) return backToBrowse;

  // If a pending request for this card already exists between us, just reopen it.
  const [existing] = await db
    .select({ id: schema.proposals.id })
    .from(schema.proposals)
    .where(
      and(
        eq(schema.proposals.fromUserId, me),
        eq(schema.proposals.toUserId, toUserId),
        eq(schema.proposals.cardId, cardId),
        eq(schema.proposals.status, "pending")
      )
    )
    .limit(1);
  if (existing) {
    return NextResponse.redirect(new URL(`/proposals/${existing.id}`, origin), {
      status: 303,
    });
  }

  // Create the request quietly and drop the asker into the thread. The owner is
  // not pinged here — that happens when the asker sends their first message, so
  // tapping Request and backing out never buzzes anyone.
  const [created] = await db
    .insert(schema.proposals)
    .values({
      fromUserId: me,
      toUserId,
      cardId,
      type,
      termsVersionAgreed: TERMS_VERSION,
    })
    .returning({ id: schema.proposals.id });

  return NextResponse.redirect(new URL(`/proposals/${created.id}`, origin), {
    status: 303,
  });
}
