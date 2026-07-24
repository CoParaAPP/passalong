/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Add a card to the member's wishlist, or remove it. Scoped to the member's
 * own rows.
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
  if (typeof cardId !== "string" || (action !== "add" && action !== "remove")) {
    return NextResponse.redirect(new URL("/wishlist", url.origin), {
      status: 303,
    });
  }

  if (action === "add") {
    // onConflictDoNothing keeps the unique (user, card) rule idempotent.
    await db
      .insert(schema.wishlist)
      .values({ userId, cardId })
      .onConflictDoNothing();
  } else {
    await db
      .delete(schema.wishlist)
      .where(
        and(
          eq(schema.wishlist.userId, userId),
          eq(schema.wishlist.cardId, cardId)
        )
      );
  }

  return NextResponse.redirect(new URL("/wishlist", url.origin), {
    status: 303,
  });
}
