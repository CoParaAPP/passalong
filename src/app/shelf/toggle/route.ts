/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Per-card sharing control. Sets a single card's visibility: private
 * (unlisted), offered to lend, or off-limits (visible but never lendable).
 * Scoped to the member's own available cards, so it only changes your own.
 */

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["unlisted", "lend", "off_limits"]);

export async function POST(request: Request) {
  const url = new URL(request.url);
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.redirect(new URL("/", url.origin), { status: 303 });
  }

  const form = await request.formData();
  const cardId = form.get("cardId");
  const to = form.get("to");
  if (typeof cardId !== "string" || typeof to !== "string" || !ALLOWED.has(to)) {
    return NextResponse.redirect(new URL("/shelf", url.origin), { status: 303 });
  }

  // Only an available card's sharing can change; an on-loan card is untouchable.
  await db
    .update(schema.ownership)
    .set({ visibility: to })
    .where(
      and(
        eq(schema.ownership.userId, userId),
        eq(schema.ownership.cardId, cardId),
        eq(schema.ownership.status, "available")
      )
    );

  return NextResponse.redirect(new URL("/shelf", url.origin), { status: 303 });
}
