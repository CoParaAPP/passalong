/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Post a message to a proposal's thread. Only the two participants can post.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOnboardedUserId } from "@/lib/guards";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const origin = new URL(request.url).origin;
  const me = await requireOnboardedUserId();
  const { id } = await params;
  const thread = new URL(`/proposals/${id}`, origin);

  const form = await request.formData();
  const body = (form.get("body") ?? "").toString().trim();

  const [proposal] = await db
    .select({
      fromUserId: schema.proposals.fromUserId,
      toUserId: schema.proposals.toUserId,
    })
    .from(schema.proposals)
    .where(eq(schema.proposals.id, id))
    .limit(1);

  // Must exist, be one of my proposals, and carry a non-empty message.
  if (
    !proposal ||
    (proposal.fromUserId !== me && proposal.toUserId !== me) ||
    !body
  ) {
    return NextResponse.redirect(thread, { status: 303 });
  }

  await db.insert(schema.messages).values({
    proposalId: id,
    fromUserId: me,
    body: body.slice(0, 1000),
  });

  return NextResponse.redirect(thread, { status: 303 });
}
