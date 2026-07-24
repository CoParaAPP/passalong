/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Per-card sharing control. Offer a single card to the group, or pull it back
 * to private. Scoped to the member's own ownership row, so it can only ever
 * change your own cards.
 */

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.redirect(new URL("/", url.origin), { status: 303 });
  }

  const form = await request.formData();
  const cardId = form.get("cardId");
  const action = form.get("action");
  if (typeof cardId !== "string" || (action !== "offer" && action !== "revoke")) {
    return NextResponse.redirect(new URL("/shelf", url.origin), { status: 303 });
  }

  const visibility = action === "offer" ? "lend" : "unlisted";
  await db
    .update(schema.ownership)
    .set({ visibility })
    .where(
      and(
        eq(schema.ownership.userId, userId),
        eq(schema.ownership.cardId, cardId)
      )
    );

  return NextResponse.redirect(new URL("/shelf", url.origin), { status: 303 });
}
