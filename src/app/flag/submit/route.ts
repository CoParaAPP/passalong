/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Records a flag for the organizer and notifies every organizer.
 */

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOnboardedUserId } from "@/lib/guards";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const me = await requireOnboardedUserId();

  const form = await request.formData();
  const body = (form.get("body") ?? "").toString().trim();
  const context = (form.get("context") ?? "").toString().trim() || null;
  const proposalIdRaw = (form.get("proposalId") ?? "").toString();

  if (!body) {
    return NextResponse.redirect(new URL("/flag", origin), { status: 303 });
  }

  // Only keep the proposal link if the reporter is actually on that proposal.
  let proposalId: string | null = null;
  if (proposalIdRaw) {
    const [p] = await db
      .select({
        fromUserId: schema.proposals.fromUserId,
        toUserId: schema.proposals.toUserId,
      })
      .from(schema.proposals)
      .where(eq(schema.proposals.id, proposalIdRaw))
      .limit(1);
    if (p && (p.fromUserId === me || p.toUserId === me)) proposalId = proposalIdRaw;
  }

  await db.insert(schema.flags).values({
    reporterId: me,
    proposalId,
    context,
    body: body.slice(0, 2000),
  });

  // Ping every organizer.
  const organizers = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.isOrganizer, true));
  for (const org of organizers) {
    // Don't self-notify if the reporter is themselves an organizer.
    if (org.id === me) continue;
    await notify(org.id, {
      kind: "flag",
      body: "A neighbor flagged something for the organizer.",
      url: "/organizer",
    });
  }

  return NextResponse.redirect(new URL("/flag?sent=1", origin), { status: 303 });
}
