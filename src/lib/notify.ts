/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Records an in-app notification for a member and, if the row is new, pushes it
 * to their devices. Both surfaces from one call.
 */

import "server-only";
import { db, schema } from "./db";
import { sendPushToUser } from "./push";

export async function notify(
  userId: string,
  opts: { kind: string; body: string; url?: string; loanId?: string | null }
): Promise<void> {
  const [row] = await db
    .insert(schema.notifications)
    .values({
      userId,
      kind: opts.kind,
      body: opts.body,
      loanId: opts.loanId ?? null,
    })
    .onConflictDoNothing()
    .returning({ id: schema.notifications.id });

  // Only push when a new row was actually created (dedup keeps it quiet).
  if (row) {
    await sendPushToUser(userId, {
      title: "Passalong",
      body: opts.body,
      url: opts.url,
    });
  }
}
