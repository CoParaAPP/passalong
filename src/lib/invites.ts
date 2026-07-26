/*
 * Passalong: a private neighborhood group lends, borrows, and swaps Yoto cards.
 * Copyright (C) 2026 Edward McWilliams and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * Invite-code helpers. Codes are reusable — a valid one just needs to exist.
 */

import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "./db";

/** True if this code exists. Codes are reusable, so existence is enough. */
export async function isInviteUsable(code: string): Promise<boolean> {
  if (!code) return false;
  const rows = await db
    .select({ id: schema.invites.id })
    .from(schema.invites)
    .where(eq(schema.invites.code, code))
    .limit(1);
  return rows.length > 0;
}
