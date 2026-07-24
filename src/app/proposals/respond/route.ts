/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * The owner accepts or declines a proposal. Only the owner (the to-user) can
 * respond, and only while it is still pending. Accepting requires agreeing to
 * the terms and may carry a condition note.
 */

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOnboardedUserId } from "@/lib/guards";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const me = await requireOnboardedUserId();
  const proposals = new URL("/proposals", origin);

  const form = await request.formData();
  const proposalId = (form.get("proposalId") ?? "").toString();
  const action = (form.get("action") ?? "").toString();
  const conditionNote = (form.get("conditionNote") ?? "").toString().trim();
  const agreed = form.get("agree") === "yes";

  if (!proposalId || (action !== "accept" && action !== "decline")) {
    return NextResponse.redirect(proposals, { status: 303 });
  }

  const [proposal] = await db
    .select({
      id: schema.proposals.id,
      toUserId: schema.proposals.toUserId,
      status: schema.proposals.status,
    })
    .from(schema.proposals)
    .where(eq(schema.proposals.id, proposalId))
    .limit(1);

  // Only the owner can respond, and only to a still-pending proposal.
  if (!proposal || proposal.toUserId !== me || proposal.status !== "pending") {
    return NextResponse.redirect(proposals, { status: 303 });
  }

  if (action === "accept" && !agreed) {
    // Terms are required to accept; bounce back without changing anything.
    return NextResponse.redirect(proposals, { status: 303 });
  }

  await db
    .update(schema.proposals)
    .set({
      status: action === "accept" ? "accepted" : "declined",
      conditionNote: action === "accept" ? conditionNote || null : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.proposals.id, proposalId),
        eq(schema.proposals.status, "pending")
      )
    );

  return NextResponse.redirect(proposals, { status: 303 });
}
