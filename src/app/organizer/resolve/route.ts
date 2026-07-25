/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * An organizer marks a flag resolved, with an optional note.
 */

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { requireOrganizer } from "@/lib/guards";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const organizerId = await requireOrganizer();

  const form = await request.formData();
  const flagId = (form.get("flagId") ?? "").toString();
  const note = (form.get("note") ?? "").toString().trim() || null;

  if (flagId) {
    await db
      .update(schema.flags)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
        resolvedById: organizerId,
        resolutionNote: note,
      })
      .where(
        and(eq(schema.flags.id, flagId), eq(schema.flags.status, "open"))
      );
  }

  return NextResponse.redirect(new URL("/organizer", origin), { status: 303 });
}
