/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * The asker withdraws their own request while it's still pending. Only the
 * requester can withdraw, and only before it's accepted or declined. The
 * request (and its thread) is removed, so a change of mind leaves no trace.
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
  const proposalId = (form.get("proposalId") ?? "").toString();

  if (proposalId) {
    // Only the asker's own, still-pending request can be withdrawn. Messages
    // cascade-delete with the proposal.
    await db
      .delete(schema.proposals)
      .where(
        and(
          eq(schema.proposals.id, proposalId),
          eq(schema.proposals.fromUserId, me),
          eq(schema.proposals.status, "pending")
        )
      );
  }

  return NextResponse.redirect(new URL("/matches", origin), { status: 303 });
}
