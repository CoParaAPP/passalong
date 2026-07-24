/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Creates a borrow or swap proposal after validating the offer still stands,
 * the terms are agreed, and there isn't already a pending one for this pair.
 */

import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOnboardedUserId } from "@/lib/guards";
import { TERMS_VERSION } from "@/lib/terms";

export const dynamic = "force-dynamic";

function back(origin: string, q: Record<string, string>): NextResponse {
  const to = new URL("/propose", origin);
  for (const [k, v] of Object.entries(q)) to.searchParams.set(k, v);
  return NextResponse.redirect(to, { status: 303 });
}

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const me = await requireOnboardedUserId();

  const form = await request.formData();
  const toUserId = (form.get("to") ?? "").toString();
  const cardId = (form.get("card") ?? "").toString();
  const type = (form.get("type") ?? "").toString();
  const returnBy = (form.get("returnBy") ?? "").toString();
  const offeredCardId = (form.get("offeredCardId") ?? "").toString();
  const agreed = form.get("agree") === "yes";

  if ((type !== "borrow" && type !== "swap") || !toUserId || !cardId || toUserId === me) {
    return NextResponse.redirect(new URL("/matches", origin), { status: 303 });
  }
  const q = { to: toUserId, card: cardId, type };

  // The owner must still be offering this card.
  const [offer] = await db
    .select({ v: schema.ownership.visibility })
    .from(schema.ownership)
    .where(
      and(
        eq(schema.ownership.userId, toUserId),
        eq(schema.ownership.cardId, cardId),
        inArray(schema.ownership.visibility, ["lend", "trade"])
      )
    )
    .limit(1);
  if (!offer) return NextResponse.redirect(new URL("/matches", origin), { status: 303 });

  if (!agreed) return back(origin, { ...q, error: "agree" });

  let returnByValue: string | null = null;
  if (type === "borrow") {
    const today = new Date().toISOString().slice(0, 10);
    if (!returnBy || returnBy <= today) return back(origin, { ...q, error: "returnby" });
    returnByValue = returnBy;
  }

  let offeredValue: string | null = null;
  if (type === "swap") {
    // Must be one of the proposer's own offered cards.
    const [mine] = await db
      .select({ id: schema.ownership.cardId })
      .from(schema.ownership)
      .where(
        and(
          eq(schema.ownership.userId, me),
          eq(schema.ownership.cardId, offeredCardId),
          inArray(schema.ownership.visibility, ["lend", "trade"])
        )
      )
      .limit(1);
    if (!mine) return back(origin, { ...q, error: "offered" });
    offeredValue = offeredCardId;
  }

  // One pending proposal per (from, to, card).
  const existing = await db
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
  if (existing.length > 0) return back(origin, { ...q, error: "duplicate" });

  await db.insert(schema.proposals).values({
    fromUserId: me,
    toUserId,
    cardId,
    type,
    offeredCardId: offeredValue,
    returnBy: returnByValue,
    termsVersionAgreed: TERMS_VERSION,
  });

  return NextResponse.redirect(new URL("/proposals", origin), { status: 303 });
}
