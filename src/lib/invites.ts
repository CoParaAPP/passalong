/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Invite-code helpers. The actual claim happens atomically inside the login
 * callback so a code can be used exactly once even under a race.
 */

import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { db, schema } from "./db";

/** True if this code exists and has not been used. A cheap pre-check for /join. */
export async function isInviteUsable(code: string): Promise<boolean> {
  if (!code) return false;
  const rows = await db
    .select({ id: schema.invites.id })
    .from(schema.invites)
    .where(and(eq(schema.invites.code, code), isNull(schema.invites.usedByUserId)))
    .limit(1);
  return rows.length > 0;
}
