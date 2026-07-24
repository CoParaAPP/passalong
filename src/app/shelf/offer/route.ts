/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Bulk "offer to the group": flips every one of the member's still-unlisted
 * cards to `lend`. Only unlisted rows change, so it never overrides an
 * off-limits or already-offered choice. Explicit opt-in, kept quick.
 */

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  const url = new URL(request.url);
  if (!userId) {
    return NextResponse.redirect(new URL("/", url.origin), { status: 303 });
  }

  await db
    .update(schema.ownership)
    .set({ visibility: "lend" })
    .where(
      and(
        eq(schema.ownership.userId, userId),
        eq(schema.ownership.visibility, "unlisted")
      )
    );

  return NextResponse.redirect(new URL("/shelf", url.origin), { status: 303 });
}
