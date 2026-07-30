/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Post a message to a proposal's thread. Only the two participants can post.
 */

import { NextResponse } from "next/server";
import { count, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOnboardedUserId } from "@/lib/guards";
import { notify } from "@/lib/notify";

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
      type: schema.proposals.type,
      cardId: schema.proposals.cardId,
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

  // Is this the first message in the thread? (Determines the notification text.)
  const [{ n: priorMessages }] = await db
    .select({ n: count() })
    .from(schema.messages)
    .where(eq(schema.messages.proposalId, id));

  await db.insert(schema.messages).values({
    proposalId: id,
    fromUserId: me,
    body: body.slice(0, 1000),
  });

  const otherId =
    proposal.fromUserId === me ? proposal.toUserId : proposal.fromUserId;
  const [sender] = await db
    .select({ username: schema.users.username })
    .from(schema.users)
    .where(eq(schema.users.id, me))
    .limit(1);
  const senderName = sender?.username ?? "A neighbor";

  // The asker's first message is the owner's first heads-up about the request,
  // so name the card. Everything after is a plain new-message ping.
  let notifyBody = `New message from ${senderName}.`;
  if (priorMessages === 0 && me === proposal.fromUserId) {
    const [card] = await db
      .select({ title: schema.cards.title })
      .from(schema.cards)
      .where(eq(schema.cards.id, proposal.cardId))
      .limit(1);
    notifyBody = `${senderName} wants to ${proposal.type} ${card?.title ?? "a card"}.`;
  }

  await notify(otherId, {
    kind: "message",
    body: notifyBody,
    url: `/proposals/${id}`,
  });

  return NextResponse.redirect(thread, { status: 303 });
}
