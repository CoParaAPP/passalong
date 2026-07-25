/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Stores (or removes) the logged-in member's Web Push subscription. POST saves
 * it; DELETE removes it when they turn notifications off.
 */

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export const dynamic = "force-dynamic";

interface Subscription {
  endpoint?: string;
  keys?: { p256dh?: string; auth?: string };
}

export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sub = (await request.json().catch(() => null)) as Subscription | null;
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys.auth) {
    return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  }

  // Upsert by endpoint so re-subscribing (or a device changing hands) is clean.
  await db
    .insert(schema.pushSubscriptions)
    .values({
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sub = (await request.json().catch(() => null)) as Subscription | null;
  if (sub?.endpoint) {
    await db
      .delete(schema.pushSubscriptions)
      .where(
        and(
          eq(schema.pushSubscriptions.endpoint, sub.endpoint),
          eq(schema.pushSubscriptions.userId, userId)
        )
      );
  }
  return NextResponse.json({ ok: true });
}
